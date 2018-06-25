# vue-blob-select

vue-blob-select is a fork of [blob-select](https://github.com/Blobfolio/blob-select), reimagined as a [Vue.js](https://vuejs.org/) component.

Both plugins provide an easy way to style pesky `<select>` elements, emphasizing markup simplicity and performance. Both plugins, also, integrate perfectly well with Vue. (Though obviously, this one *only* works with Vue.)

So why the fork?

Because the original [blob-select](https://github.com/Blobfolio/blob-select) is dependency-free, it contains a lot of code that is redundant when a framework like Vue is also present. Cutting those bits out reduces the size of the Javascript by over 50%.

Leveraging Vue's advanced DOM and caching features lead to some runtime performance wins, particularly with change detection and repainting operations. Aside from faster performance, the overall memory footprint is also slightly reduced.

That said, because Vue components require special markup (a `<blob-select />` tag in this case), you need to be able to control the document's `<form>` markup. If you're trying to style ugly third-party content — from Pardot, Wufoo, etc. — the original [blob-select](https://github.com/Blobfolio/blob-select) is a better choice since it works with true `<select>` elements.



##### Table of Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Use](#use)
   * [Installation](#installation)
   * [Configuration](#configuration)
4. [Styling](#styling)
5. [License](#license)



&nbsp;

## Features

vue-blob-select has all the same features as [blob-select](https://github.com/Blobfolio/blob-select#features). For more details, check out that README.



&nbsp;

## Requirements

vue-blob-select is a Vue component, and as such requires [Vue.js](https://vuejs.org/). But other than that, there are no special dependencies.

It is compatible with all major modern web browsers, and ~~the browser that just won't die~~ IE 11.

This plugin does make use of some ES6 markup like `let` and `const`. If your project needs to support *old* browsers, you will need to first transpile `vue-blobselect.min.js` to ES5 with a tool like [Babel](https://babeljs.io/), then serve that copy to visitors.



&nbsp;

## Use


### Installation

Grab a copy of `dist/vue-blobselect.min.js` and throw it onto the page:

```html
<script src="/path/to/vue.min.js"></script>
<script src="/path/to/vue-blobselect.min.js"></script>
<script src="/path/to/your-vue-project.min.js"></script>
```

If a global `window.Vue` exists, the component should self-register. Otherwise you can register it like any other component via something like:

```javascript
import blobSelect from './vue-blobselect.min.js';
Vue.component(blobSelect);
```

Aside from the main script, you'll also need some CSS styles. You can either plug in the default stylesheet from `dist/css/` or take a look at the source in `src/scss/` to roll your own.



### Configuration

While the features and eventual markup of this fork maintain full parity with [blob-select](https://github.com/Blobfolio/blob-select), the configuration for this plugin is handled in a more Vue-centric way.

The general idea is to throw a `<blob-select />` element on the page, specifying any settings as attributes.

```html
<blob-select v-model="some.model" :any-props="some.value"…></blob-select>
```

The component has bi-directional `model` support, so you can bind the `<select>` value to any Vue data you want. To treat values numerically, use `v-model.number="foo"` in combination with `value-type='number'`. Otherwise it's strings all the way down.

The following properties can be set on the component. To set them dynamically (to e.g. Vue data), prefix the field with a `:`, otherwise if passing a literal, just throw it in as any old attribute.

Any attributes not mentioned below will be copied to the `.blobselect` container. You can set classes in this way; they'll just be merged with the plugin's.

| Type | Key | Description | Default |
| ---- | --- | ----------- | ------- |
| *string* | **id** | An ID to apply to the true `<select>` field. | `"blobselect"` |
| *string* | **name** | A name to apply to the true `<select>` field. | `"blobselect"` |
| *array* | **items** | These are your `<option>`s. See below for more information. | `[]` |
| *bool* | **disabled** | Disable the entire field. | `FALSE` |
| *bool* | **multiple** | Mimic `[multiple]` behaviors. | `FALSE` |
| *bool* | **placeholder** | Enable a placeholder-like null `<option>`. | `FALSE` |
| *bool* | **required** | Mark the field required. | `FALSE` |
| *bool* | **search** | Enable the search/filter bar. | `FALSE` |
| *string* | **sort** | Sort items either `"ASC"` or `"DESC"`. | `""` (no sorting) |
| *string* | **field-placeholder** | When **placeholder** is `TRUE` and no value is selected, this text will appear in the main field. | `"---"` |
| *string* | **label-placeholder** | When **placeholder** is `TRUE`, a null `<option>` with this text will be added to the menu. | `"---"` |
| *string* | **label-type** | If **sort** is enabled, you can set this to `"number"` to treat labels as numbers when sorting. | `"string"` |
| *string* | **value-type** | Set this to `"number"` to treat values as numbers rathre than strings. If binding a model, also be sure to use the `.number` modifier. | `"string"` |

#### Items

Items (i.e. `<option>`s) should be passed as an `Array` via the `:items="[…]"` attribute on the component.

Each item — an element of the items array — can be either a simple, flat value like `"foo"`, or an object specifying that item's properties.

For flat items, the value and label will be the same, e.g. `<option value="foo">foo</option>`.

The following settings can be specified for any item defined as an object:

| Type | Key | Description | Default |
| ---- | --- | ----------- | ------- |
| *string* | **group** | A group label to mimic `<optgroup>` suborganization. | `""` |
| *mixed* | **label** | The item label. The data type should match the main **label-type** property. | `""` or `0` |
| *mixed* | **value** | The item value. The data type should match the main **value-type** property. | `""` or `0` |
| *bool* | **disabled** | Mark the item disabled. If the component itself is disabled, this setting has no effect. | `FALSE` |

To see an example, check out `src/demo.html`.



&nbsp;

## Styling

The markup resulting from vue-blob-select is identical to that generated by the original [blob-select](https://github.com/Blobfolio/blob-select#styling). For more details, check out that README.

Otherwise the SCSS source folder includes example styles to get you started.



&nbsp;

## License

Copyright © 2018 [Blobfolio, LLC](https://blobfolio.com) &lt;hello@blobfolio.com&gt;

This work is free. You can redistribute it and/or modify it under the terms of the Do What The Fuck You Want To Public License, Version 2.

    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    Version 2, December 2004
    
    Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>
    
    Everyone is permitted to copy and distribute verbatim or modified
    copies of this license document, and changing it is allowed as long
    as the name is changed.
    
    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION
    
    0. You just DO WHAT THE FUCK YOU WANT TO.

### Donations

<table>
  <tbody>
    <tr>
      <td width="200"><img src="https://blobfolio.com/wp-content/themes/b3/svg/btc-github.svg" width="200" height="200" alt="Bitcoin QR" /></td>
      <td width="450">If you have found this work useful and would like to contribute financially, Bitcoin tips are always welcome!<br /><br /><strong>1Af56Nxauv8M1ChyQxtBe1yvdp2jtaB1GF</strong></td>
    </tr>
  </tbody>
</table>
