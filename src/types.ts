export interface DashCustomElementImport {
  /**
   * ESM module containing the custom-element class.
   */
  importPath: string;
  /**
   * Named class export to register with customElements.define().
   *
   * Omit this when importing a module that registers the element as a side
   * effect.
   */
  exportName?: string;
  /**
   * Named module export that registers the custom element and its transitive
   * dependencies. When present, the generated bridge calls this function
   * instead of defining only the exported class.
   */
  defineCustomElement?: string;
}

export interface DashOutputTargetOptions {
  /**
   * Directory receiving deterministic `*.react.js` bridge files.
   * Relative paths are resolved from Stencil's rootDir.
   */
  outputDir: string;
  /**
   * Component tag names to generate. Defaults to every public component.
   */
  components?: string[];
  /**
   * Override the generated PascalCase React component name by tag.
   */
  componentNames?: Record<string, string>;
  /**
   * Custom-element module imports keyed by tag.
   */
  customElements?: Record<string, DashCustomElementImport>;
  /**
   * Stencil properties that must not cross the Dash JSON boundary.
   */
  excludeProperties?: string[];
  /**
   * Native custom-event name to Dash property name.
   *
   * Public Stencil events are exposed automatically under their native names.
   * Use this option to alias an event. Mapped events also remain active by
   * default for backwards compatibility.
   */
  eventMappings?: Record<string, string>;
  /**
   * Public Stencil event names that are active without listing them in the
   * generated component's `eventListeners` prop.
   */
  defaultEvents?: string[];
}

export interface DashPropertyMeta {
  name: string;
  type: 'any' | 'string' | 'boolean' | 'number' | 'unknown';
  complexType: {
    original: string;
    resolved: string;
  };
  docs: {
    text: string;
  };
  optional: boolean;
  required: boolean;
  internal: boolean;
}

export interface DashEventMeta {
  name: string;
  docs: {
    text: string;
  };
  internal: boolean;
}

export interface DashComponentMeta {
  tagName: string;
  componentClassName: string;
  docs: {
    text: string;
  };
  internal: boolean;
  properties: DashPropertyMeta[];
  events: DashEventMeta[];
}
