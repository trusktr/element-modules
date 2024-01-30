// @ts-check

const moduleSpecifier = /(?:import|from)\s*['"](.+?)['"]/gm // regexr.com/7r66e
const classHeader = /export\s*default\s*class\s*([a-zA-Z]*)\s*(?:extends\s*([a-zA-Z]+))?\s*{/

export async function import_concept(importSpecifier, importAttributes) {
	const htmlCode = await fetch(importSpecifier).then(r => r.text())

	// Base URL so we can run the "element module" with the correct
	// `import.meta.url` other things like relative URLs in the HTML code will
	// also work, etc.
	const htmlUrl = new URL(importSpecifier, import.meta.url).href
	console.log(htmlUrl)

	// Easy way to work with the code is to parse it into an AST :)
	const parser = new DOMParser()
	const doc = parser.parseFromString(htmlCode, 'text/html')

	for (const [i, def] of /**@type {Array<HTMLElement>}*/ (Array.from(doc.querySelectorAll('element'))).entries()) {
		const elementName = def.getAttribute('name')

		// if no name, no automatic definition (TODO derive from class name as fallback?)
		if (elementName) {
			const exported = def.getAttribute('export') // TODO export classes marked with export
			const shadowMode = /** @type {'open' | 'closed'} */ (def.getAttribute('shadowmode')) ?? 'open'
			const scripts = def.querySelectorAll('script')
			const scriptEl = scripts[0]

			for (const script of Array.from(scripts)) script.remove()

			let userCode = scriptEl?.textContent

			// If the user did not provide a script, define an implicit class.
			if (!userCode) userCode = `export default class extends HTMLElement {}`

			// If there's a user script but no exported class, imply the default class.
			if (!userCode.match(classHeader)) userCode += `; export default class extends HTMLElement {}`

			userCode = implementImportMetaUrl(userCode, htmlUrl)
			userCode = implementRelativeSpecifiers(userCode, htmlUrl)

			const header = userCode.match(classHeader)[0]

			// Place the template inside the user class definition so it can access private fields.
			userCode = userCode.replace(
				header,
				/*js*/ `const __TEMPLATE__ = Symbol()
                ${header}
                [__TEMPLATE__] = () => html\`${def.innerHTML}\``,
			)

			const newHeader = header.replace('export default', 'const __DEFAULT_EXPORT__ =')
			userCode = userCode.replace(header, newHeader)

			userCode += /*js*/ `
                import {html} from 'pota/src/renderer/@main.js'

                const Class = __DEFAULT_EXPORT__

                /** @param {string} str */
                function toCamelCase(str) {
                    return str.replace(/-[a-zA-Z]/g, s => s[1].toUpperCase())
                }

                let bypassAttachShadowRestriction = false

                // TODO use scoped registry for the non-exported element
                // (internal-el) so it remains internal to some-el instead of
                // globally defined.
                // Perhaps try with the polyfill: https://github.com/webcomponents/polyfills/blob/master/packages/scoped-custom-element-registry
                // const scopedElements = new CustomElementRegistry()

                // In the native implementation, we would not extend from the
                // author's class, the definition would be the author's class
                // directly. We just do this as a way to attach a shadow root to
                // show a rough concept. In the native implementation, the
                // element instance will already have a shadow root by the time
                // the author's class runs and will be available via
                // ElementInternals (similar to DSD), and this roughly
                // approximates that by forcing attachShadow() throw an error
                // when we have not allowed it to be callable using
                // bypassAttachShadowRestriction.
                export default class extends Class {
                    static name = toCamelCase("${elementName}")

                    /** @type {ElementInternals} */
                    #internals

                    constructor() {
                        super()
                        if (!this.#internals) this.attachInternals()
                    }

                    /**
                     * @param {ShadowRootInit} init
                     * @returns {ShadowRoot}
                     */
                    attachShadow(init) {
                        // Element authors cannot call attachShadow for elements
                        // defined by element module, but we need to call it to
                        // create the root, so we allow only this ponyfill to
                        // call it.
                        if (bypassAttachShadowRestriction) return super.attachShadow(init)
                        throw new TypeError('attachShadow() cannot be called on elements imported from element modules. Use attachInternals().shadowRoot instead.')
                    }

                    attachInternals() {
                        this.#internals = super.attachInternals()

                        // In the current concept design, it should be impossible for the CE author to use attachShadow, the
                        // root should pre-exist from based on the HTML template that is wrapping the user's <script>.
                        if (this.#internals.shadowRoot) throw new Error('No handling of pre-existing ShadowRoot for now.')

                        bypassAttachShadowRestriction = true
                        const root = this.attachShadow({mode: "${shadowMode}" /*, todo customElements: scopedElements */})
                        bypassAttachShadowRestriction = false

                        const dom = this[__TEMPLATE__]()
                        root.append(...[dom].flat(Infinity))

                        return this.#internals
                    }
                }
            `

			const userCodeUrl = URL.createObjectURL(new Blob([userCode], {type: 'application/javascript'}))

			const module = await import(userCodeUrl)

			URL.revokeObjectURL(userCodeUrl)

			/** @type {typeof HTMLElement | undefined} */
			const Class = module.default

			customElements.define(elementName, Class)
		}
	}
}

/**
 * Replace `import.meta.url` with something actually usable (because we make
 * modules out of blobs, and their native import.meta.url will be a blob: URL
 * and hence relative paths will not work in cases like `new URL('./foo',
 * import.meta.url)`).
 *
 * This is naive, for sake of example. It should use an AST so that it will not
 * replace `import.meta.url` inside comments, strings, etc.
 *
 * @param {string} jsCode
 * @param {string} baseUrl
 */
function implementImportMetaUrl(jsCode, baseUrl) {
	return jsCode.replaceAll('import.meta.url', '"' + baseUrl + '"')
}

/**
 * Replaces relative module specifiers with absolute URLs based on the path of
 * the HTML file being imported.
 *
 * This is naive, for sake of example. It should not override any relative paths
 * that are mapped in an importmap, but currently it will.
 *
 * @param {string} jsCode
 * @param {string} baseUrl
 */
function implementRelativeSpecifiers(/**@type {string}*/ jsCode, /**@type {string}*/ baseUrl) {
	return jsCode.replace(moduleSpecifier, (s, specifier) => {
		console.log(s.replace(specifier, new URL(specifier, baseUrl).href))
		const isRelative = specifier.startsWith('.')
		if (isRelative) return s.replace(specifier, new URL(specifier, baseUrl).href)
		else return s
	})
}
