# Element Modules

A concept that illustrates the ability to write custom elements delaratively in
separate HTML files that can be `import`ed as "element modules".

This demo shows the rough behavior as expected by an end developer, and the
implementation is not realistic and has quirks and edge cases that a native
implementation will not have (see comments). It is only a concept to show the
rough idea.

To run, just clone, and statically serve the files (f.e. `npx five-server .`
with Node.js installed).

# Live Example

[Demo on CodePen](https://codepen.io/trusktr/pen/gOEWGXV)

# Basic Usage

An element module file (`.html`) defines and exports an element:

```html
<element name="cool-el" export>
  <div>Hello</div>

  <span>Value from module scope: ${foo}</span>
  <span>Value from global scope: ${document.body.tagName}</span>
  <span>Value from class field: ${this.publicValue}</span>
  <span>Value from class private field: ${this.#privateValue}</span>
  <span>Value from attribute: ${this.attributes['some-attribute'].value}</span>

  <div>
    <slot></slot>
  </div>

  <style>
    div {
      border: 5px solid pink;
    }
  </style>

  <!-- Script tag is totally optional, only if you need logic. -->
  <script>
    import {foo} from 'somewhere'

    export default class extends HTMLElement {
      publicValue = 123
      #privateValue = 456

      connectedCallback() {
        console.log('cool-el connected')
      }
    }
  </script>
</element>
```

Consumer in another element module file (or top level document HTML) imports the element and uses it:

```html
<cool-el></cool-el>

<script type="module">
  import './cool-el.html' with { type: 'elements', define: true } // not sure if import attributes for auto defining is a good idea or not. What happens if multiple import statements to the same file auto define and don't auto define?
</script>
<!-- or -->
<script type="elements" src="./cool-el.html" define></script>
<!-- or something -->
```
