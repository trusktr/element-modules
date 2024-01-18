export async function import_concept(importSpecifier, attributes) {
	const code = await fetch(importSpecifier).then(r => r.text())

	// Easy way to work with the code is to parse it into an AST :)
	const parser = new DOMParser()
	const doc = parser.parseFromString(code, 'text/html')

	for (const def of Array.from(doc.querySelectorAll('element'))) {
		const name = def.getAttribute('name')
		const exported = def.getAttribute('export')
		const shadowMode = def.getAttribute('shadowmode') ?? 'open'
		const scripts = def.querySelectorAll('script')
		const scriptEl = scripts[0]

		for (const script of Array.from(scripts)) script.remove()

		const script = scriptEl?.textContent
		let module = {}

		if (script) {
			const scriptUrl = URL.createObjectURL(new Blob([script], {type: 'application/javascript'}))
			module = await import(scriptUrl)
			URL.revokeObjectURL(scriptUrl)
		}

		/** @type {typeof HTMLElement | undefined} */
		const Class = module.default

		// if no name, no automatic definition.
		if (name) {
			// TODO use scoped registry for the non-exported element (internal-el) so it remains internal to some-el.
			// Perhaps try with the polyfill: https://github.com/webcomponents/polyfills/blob/master/packages/scoped-custom-element-registry
			// const scopedElements = new CustomElementRegistry()

			customElements.define(
				name,

				// In the native implementation, we would not extend from the
				// author's class, the definition would be the author's class
				// directly. We just do this as a way to attach a shadow root to
				// show a rough concept. This is not accurate: The element will
				// already have a shadow root by the time the author's class
				// runs (like DSD), but in this rough concept, `this.shadowRoot`
				// in the author's constructor will be `null`, and if they call
				// `attachShadow`, the method will not error as it would if the
				// root already pre-existed.
				class extends (Class ?? HTMLElement) {
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
						if (this.#internals.shadowRoot) throw new Error('just a concept')
						const root = this.attachShadow({mode: shadowMode /*, todo customElements: scopedElements */})
						root.append(...Array.from(def.cloneNode(true).children))
						return this.#internals
					}
				},
			)
		}
	}
}
