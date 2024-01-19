# Element Modules

A concept that illustrates the ability to write custom elements delaratively in
separate HTML files that can be `import`ed as "element modules".

This demo shows the rough behavior as expected by an end developer, and the
implementation is not realistic and has quirks and edge cases that a native
implementation will not have (see comments). It is only a concept to show the
rough idea.

To run, just clone, and statically serve the files (f.e. `npx five-server .`
with Node.js installed).

# Example

An element module file (`.html`) defines and exports an element:

```html
<element name="cool-el" export>
  <div>Hello</div>

  <div>
    <slot></slot>
  </div>

  <style>
    div {
      border: 5px solid pink;
    }
  </style>
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
