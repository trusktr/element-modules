// @ts-check
import {html} from 'pota/src/renderer/@main.js'

let bypassAttachShadowRestriction = false

export async function import_concept(importSpecifier, attributes) {
	const htmlCode = await fetch(importSpecifier).then(r => r.text())

	// Easy way to work with the code is to parse it into an AST :)
	const parser = new DOMParser()
	const doc = parser.parseFromString(htmlCode, 'text/html')

	for (const def of /**@type {Array<HTMLElement>}*/ (Array.from(doc.querySelectorAll('element')))) {
		const elementName = def.getAttribute('name')

		// if no name, no automatic definition (TODO derive from class name as fallback?)
		if (elementName) {
			const exported = def.getAttribute('export')
			const shadowMode = /** @type {'open' | 'closed'} */ (def.getAttribute('shadowmode')) ?? 'open'
			const scripts = def.querySelectorAll('script')
			const scriptEl = scripts[0]

			for (const script of Array.from(scripts)) script.remove()

			let jsCode = scriptEl?.textContent

			let module = {}

			if (jsCode) {
				jsCode = implyClassNameAndBaseClass(jsCode, elementName)

				const scriptUrl = URL.createObjectURL(new Blob([jsCode], {type: 'application/javascript'}))
				module = await import(scriptUrl)
				URL.revokeObjectURL(scriptUrl)
			}

			/** @type {typeof HTMLElement | undefined} */
			const Class = module.default

			// TODO use scoped registry for the non-exported element (internal-el) so it remains internal to some-el.
			// Perhaps try with the polyfill: https://github.com/webcomponents/polyfills/blob/master/packages/scoped-custom-element-registry
			// const scopedElements = new CustomElementRegistry()

			// In the native implementation, we would not extend from the
			// author's class, the definition would be the author's class
			// directly. We just do this as a way to attach a shadow root to
			// show a rough concept. This is not accurate: The element will
			// already have a shadow root by the time the author's class
			// runs (like DSD), but in this rough concept, `this.shadowRoot`
			// in the author's constructor will be `null`, and if they call
			// `attachShadow`, the method will not error as it would if the
			// root already pre-existed.
			const Wrapper = class extends (Class ?? HTMLElement) {
				// @ts-expect-error
				static name = toCamelCase(/**@type {string}*/ (elementName))

				/** @type {ElementInternals} */
				#internals

				constructor() {
					super()
					if (!this.#internals) this.attachInternals()
				}

				attachInternals() {
					this.#internals = super.attachInternals()

					// In the real implementation, it will be impossible for
					// the shadow root to already exist.
					if (this.#internals.shadowRoot) throw new Error('Just a concept!')

					bypassAttachShadowRestriction = true
					const root = this.attachShadow({mode: shadowMode /*, todo customElements: scopedElements */})
					bypassAttachShadowRestriction = false

					const render = eval(`() => html\`${def.innerHTML}\``)
					root.append(...[render()].flat(Infinity))

					return this.#internals
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

					throw new TypeError(
						'attachShadow() cannot be called on elements imported from element modules. Use attachInternals().shadowRoot instead.',
					)
				}
			}

			customElements.define(elementName, Wrapper)
		}
	}
}

/** @param {string} str */
function toCamelCase(str) {
	return str.replace(/-[a-zA-Z]/g, s => s[1].toUpperCase())
}

/**
 * @param {string} jsCode
 * @param {string} elementName
 */
function implyClassNameAndBaseClass(jsCode, elementName) {
	// Allows classes to implicitly extend from HTMLElement instead of
	// Object if extends is not specified (this is naive, just for the
	// concept, it assumes "export default class" to be at the top
	// level), and imply the class name from the element name.
	const classHeader = /export\s*default\s*class\s*([a-zA-Z]*)\s*(?:extends\s*([a-zA-Z]+))?\s*{/
	const headerMatch = jsCode.match(classHeader)

	if (headerMatch) {
		const [className, baseClass] = headerMatch[1]
		let header = headerMatch[0]

		if (!baseClass) header = header.replace('{', 'extends HTMLElement {')
		if (!className) header = header.replace('class', 'class ' + toCamelCase(elementName))

		jsCode = jsCode.replace(headerMatch[0], header)
	}

	return jsCode
}
