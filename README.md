# Stencil Dash output target

`@revolist/stencil-dash-output-target` generates the React bridge consumed by
Plotly's official `dash-generate-components` command.

## Installation

```bash
npm install --save-dev @revolist/stencil-dash-output-target
```

```ts
import { dashOutputTarget } from '@revolist/stencil-dash-output-target';

dashOutputTarget({
  outputDir: './packages/dash/src/lib/components',
  components: ['revo-grid'],
  componentNames: {
    'revo-grid': 'RevoGrid',
  },
  customElements: {
    'revo-grid': {
      importPath: '@revolist/revogrid/standalone/revo-grid.js',
      defineCustomElement: 'defineCustomElement',
    },
  },
  excludeProperties: ['plugins', 'editors'],
  // Public Stencil events are discovered automatically.
  defaultEvents: ['afteredit'],
});
```

The generated bridge assigns Stencil properties directly to the custom element,
mounts it only after initial properties and lifecycle listeners are attached,
emits JSON-safe event envelopes through Dash `setProps`, and documents its
PropTypes for Dash's Python generator.

Options:

- `outputDir`: required destination for generated `.react.js` files.
- `components`: optional public Stencil tag-name allowlist.
- `componentNames`: optional tag-to-React-name overrides.
- `customElements`: optional imports that either self-register, export a
  custom-element class, or export an idempotent `defineCustomElement` function.
- `excludeProperties`: property names that cannot cross the Dash boundary.
- `defaultEvents`: auto-discovered event names that remain active without being
  listed in the generated component's `eventListeners` property.
- `eventMappings`: optional aliases for auto-discovered public events. Mapped
  events also remain active by default for backwards compatibility.

Public Stencil properties and events are read directly from compiler metadata.
Properties become Dash properties automatically. Public events with valid
property names also become same-name Dash event properties; internal events are
excluded. Event names that are not valid identifiers can be exposed with an
explicit alias in `eventMappings`.

To avoid unconditional updates from high-frequency events, only
`defaultEvents` and explicitly mapped events are active by default. Add any
other discovered event name to the generated component's `eventListeners`
property; its envelope is published to the corresponding generated event
property and the backwards-compatible `eventData` property. Names that are not
present in Stencil metadata, such as runtime plugin events, continue to publish
through `eventData` only.

The output target does not decide which component properties are safe at a Python
boundary. Consumers must exclude function-, class-, Promise-, DOM-, and
framework-specific properties from their output-target configuration.
