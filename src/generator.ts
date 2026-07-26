import path from 'node:path';

import type { DashComponentMeta, DashOutputTargetOptions } from './types.js';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const BRIDGE_PROPERTY_NAMES = new Set([
  'id',
  'className',
  'style',
  'eventListeners',
  'eventData',
  'syncSourceOnEdit',
  'setProps',
]);

function quote(value: string): string {
  return JSON.stringify(value);
}

function cleanDoc(value: string | undefined): string {
  return (value || '')
    .replaceAll('*/', '*\\/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toPascalCase(value: string): string {
  const result = value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
  return /^\d/.test(result) ? `Component${result}` : result;
}

function propTypeForPrimitive(type: string): string | undefined {
  if (type === 'string') {
    return 'PropTypes.string';
  }
  if (type === 'boolean') {
    return 'PropTypes.bool';
  }
  if (type === 'number') {
    return 'PropTypes.number';
  }
  return undefined;
}

function splitTopLevelTypes(source: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let quoteCharacter = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoteCharacter) {
      current += character;
      if (
        character === quoteCharacter &&
        source[index - 1] !== '\\'
      ) {
        quoteCharacter = '';
      }
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quoteCharacter = character;
      current += character;
      continue;
    }
    if ('<[{('.includes(character)) {
      depth += 1;
    } else if ('>]}'.includes(character) || character === ')') {
      depth = Math.max(0, depth - 1);
    }
    if (character === '|' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

export function propTypeForProperty(
  property: DashComponentMeta['properties'][number],
): string {
  const directType = propTypeForPrimitive(property.type);
  if (directType) {
    return directType;
  }
  const source = (
    property.complexType.resolved ||
    property.complexType.original
  ).toLowerCase();
  const topLevelTypes = splitTopLevelTypes(source);
  const candidates = new Set<string>();
  for (const type of topLevelTypes) {
    if (type === 'boolean' || type === 'true' || type === 'false') {
      candidates.add('PropTypes.bool');
    } else if (type === 'number') {
      candidates.add('PropTypes.number');
    } else if (type === 'string' || /^['"].*['"]$/.test(type)) {
      candidates.add('PropTypes.string');
    } else if (
      /\[\]$|^array<|^readonlyarray<|^\[/.test(type)
    ) {
      candidates.add('PropTypes.array');
    } else if (
      /^record<|^object$|^\{|^map<|^set</.test(type)
    ) {
      candidates.add('PropTypes.object');
    } else if (/=>|^function\b/.test(type)) {
      candidates.add('PropTypes.func');
    } else if (type !== 'undefined' && type !== 'null') {
      candidates.add('PropTypes.any');
    }
  }
  if (candidates.size === 1) {
    return [...candidates][0];
  }
  if (candidates.size > 1) {
    return `PropTypes.oneOfType([${[...candidates].sort().join(', ')}])`;
  }
  return 'PropTypes.any';
}

export function validateDashOutputTargetOptions(
  options: DashOutputTargetOptions,
): string[] {
  const errors: string[] = [];
  if (!options || typeof options !== 'object') {
    return ['options must be an object'];
  }
  if (!options.outputDir || typeof options.outputDir !== 'string') {
    errors.push('outputDir must be a non-empty string');
  }
  if (
    options.components &&
    (!Array.isArray(options.components) ||
      options.components.some(component => typeof component !== 'string' || !component))
  ) {
    errors.push('components must contain non-empty tag names');
  }
  if (
    options.defaultEvents &&
    (!Array.isArray(options.defaultEvents) ||
      options.defaultEvents.some(event => typeof event !== 'string' || !event))
  ) {
    errors.push('defaultEvents must contain non-empty event names');
  }
  for (const [tagName, componentName] of Object.entries(
    options.componentNames || {},
  )) {
    if (!tagName || !IDENTIFIER.test(componentName)) {
      errors.push(
        `componentNames[${quote(tagName)}] must be a valid JavaScript identifier`,
      );
    }
  }
  for (const [tagName, customElement] of Object.entries(
    options.customElements || {},
  )) {
    if (
      !tagName ||
      !customElement ||
      typeof customElement.importPath !== 'string' ||
      !customElement.importPath
    ) {
      errors.push(
        `customElements[${quote(tagName)}].importPath must be a non-empty string`,
      );
    }
    if (
      customElement?.exportName &&
      !IDENTIFIER.test(customElement.exportName)
    ) {
      errors.push(
        `customElements[${quote(tagName)}].exportName must be a valid JavaScript identifier`,
      );
    }
    if (
      customElement?.defineCustomElement &&
      !IDENTIFIER.test(customElement.defineCustomElement)
    ) {
      errors.push(
        `customElements[${quote(tagName)}].defineCustomElement must be a valid JavaScript identifier`,
      );
    }
  }
  for (const [eventName, propName] of Object.entries(
    options.eventMappings || {},
  )) {
    if (!eventName || !IDENTIFIER.test(propName)) {
      errors.push(
        `eventMappings[${quote(eventName)}] must be a valid JavaScript identifier`,
      );
    }
  }
  return errors;
}

function renderCustomElementImport(
  component: DashComponentMeta,
  componentName: string,
  options: DashOutputTargetOptions,
): string {
  const customElement = options.customElements?.[component.tagName];
  if (!customElement) {
    return '';
  }
  if (customElement.defineCustomElement) {
    const localName = `define${componentName}CustomElement`;
    return `import { ${customElement.defineCustomElement} as ${localName} } from ${quote(customElement.importPath)};

if (
  typeof customElements !== 'undefined'
) {
  ${localName}();
}
`;
  }
  if (!customElement.exportName) {
    return `import ${quote(customElement.importPath)};\n`;
  }
  const localName = `${componentName}CustomElement`;
  return `import { ${customElement.exportName} as ${localName} } from ${quote(customElement.importPath)};

if (
  typeof customElements !== 'undefined' &&
  !customElements.get(${quote(component.tagName)})
) {
  customElements.define(${quote(component.tagName)}, ${localName});
}
`;
}

function renderPropType(
  name: string,
  type: string,
  docs: string,
  required = false,
): string {
  const description = cleanDoc(docs);
  const comment = description ? `  /** ${description} */\n` : '';
  return `${comment}  ${name}: ${type}${required ? '.isRequired' : ''},`;
}

function resolveEventMappings(
  component: DashComponentMeta,
  propertyNames: readonly string[],
  options: DashOutputTargetOptions,
): {
  eventMappings: [eventName: string, dashProp: string][];
  defaultEventNames: string[];
} {
  const publicEvents = component.events
    .filter(event => !event.internal)
    .sort((left, right) => left.name.localeCompare(right.name));
  const componentEventNames = new Set(
    publicEvents.map(event => event.name),
  );
  const explicitMappings = new Map(
    Object.entries(options.eventMappings || {}),
  );
  const defaultEventNames = new Set([
    ...(options.defaultEvents || []),
    ...explicitMappings.keys(),
  ]);
  for (const eventName of defaultEventNames) {
    if (!componentEventNames.has(eventName)) {
      throw new Error(
        `Event ${quote(eventName)} is not emitted by ${quote(component.tagName)}`,
      );
    }
  }

  const unavailablePropertyNames = new Set([
    ...BRIDGE_PROPERTY_NAMES,
    ...propertyNames,
  ]);
  const mappedPropertyNames = new Map<string, string>();
  const eventMappings: [string, string][] = [];
  for (const event of publicEvents) {
    const dashProp = explicitMappings.get(event.name) || event.name;
    if (!IDENTIFIER.test(dashProp)) {
      continue;
    }
    if (unavailablePropertyNames.has(dashProp)) {
      throw new Error(
        `Event ${quote(event.name)} maps to reserved or component property ${quote(dashProp)} in ${quote(component.tagName)}`,
      );
    }
    const existingEvent = mappedPropertyNames.get(dashProp);
    if (existingEvent) {
      throw new Error(
        `Events ${quote(existingEvent)} and ${quote(event.name)} both map to Dash property ${quote(dashProp)} in ${quote(component.tagName)}`,
      );
    }
    mappedPropertyNames.set(dashProp, event.name);
    eventMappings.push([event.name, dashProp]);
  }
  return {
    eventMappings,
    defaultEventNames: [...defaultEventNames].sort(),
  };
}

export function generateReactComponent(
  component: DashComponentMeta,
  options: DashOutputTargetOptions,
): { componentName: string; fileName: string; source: string } {
  const componentName =
    options.componentNames?.[component.tagName] ||
    toPascalCase(component.tagName);
  if (!IDENTIFIER.test(componentName)) {
    throw new Error(
      `Invalid generated component name ${quote(componentName)} for ${quote(component.tagName)}`,
    );
  }
  const excluded = new Set(options.excludeProperties || []);
  const properties = component.properties
    .filter(property => !property.internal && !excluded.has(property.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const eventDocs = new Map(
    component.events.map(event => [event.name, event.docs.text]),
  );
  const propertyNames = properties.map(property => property.name);
  const {
    eventMappings,
    defaultEventNames,
  } = resolveEventMappings(component, propertyNames, options);
  const customElementImport = renderCustomElementImport(
    component,
    componentName,
    options,
  );
  const propTypes = [
    renderPropType('id', 'PropTypes.string', 'Dash component identifier.'),
    renderPropType(
      'className',
      'PropTypes.string',
      `CSS class applied to the ${componentName} component host.`,
    ),
    renderPropType(
      'style',
      'PropTypes.object',
      `Inline style applied to the ${componentName} component host.`,
    ),
    ...properties.map(property =>
      renderPropType(
        property.name,
        propTypeForProperty(property),
        property.docs.text,
        property.required,
      ),
    ),
    ...eventMappings.map(([eventName, dashProp]) =>
      renderPropType(
        dashProp,
        'PropTypes.object',
        `${eventDocs.get(eventName) || `${eventName} event.`} Contains a JSON-safe event envelope.`,
      ),
    ),
    renderPropType(
      'eventListeners',
      'PropTypes.arrayOf(PropTypes.string)',
      `Additional ${componentName} event names to publish through eventData.`,
    ),
    renderPropType(
      'eventData',
      'PropTypes.object',
      'Latest JSON-safe event envelope from eventListeners.',
    ),
    renderPropType(
      'syncSourceOnEdit',
      'PropTypes.bool',
      'When true, afteredit also updates the complete Dash source property.',
    ),
    renderPropType(
      'setProps',
      'PropTypes.func',
      'Dash callback used to report property changes.',
    ),
  ].join('\n');
  const eventMappingSource = JSON.stringify(
    Object.fromEntries(eventMappings),
    null,
    2,
  );
  const defaultEventNamesSource = JSON.stringify(defaultEventNames);
  const componentDoc =
    cleanDoc(component.docs.text) ||
    `Dash bridge for the ${component.tagName} custom element.`;
  const source = `// Generated by @revolist/stencil-dash-output-target. Do not edit.
import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import {
  applyElementProperties,
  bindEventListeners,
  compactAfterEditDetail,
  createEventEnvelope,
  createSourceSyncToken,
  normalizeEventNames,
} from '@revolist/stencil-dash-output-target/runtime';
${customElementImport}
const GRID_PROPERTY_NAMES = Object.freeze(${JSON.stringify(propertyNames)});
const EVENT_MAPPINGS = Object.freeze(${eventMappingSource});
const DEFAULT_EVENT_NAMES = Object.freeze(${defaultEventNamesSource});

/**
 * ${componentDoc}
 */
const ${componentName} = forwardRef(function ${componentName}(props, forwardedRef) {
  const hostRef = useRef(null);
  const elementRef = useRef(null);
  const previousPropsRef = useRef({});
  const pendingSourceSyncRef = useRef(null);
  const sequenceRef = useRef(0);

  if (!elementRef.current && typeof document !== 'undefined') {
    const element = document.createElement(${quote(component.tagName)});
    element.style.display = 'block';
    element.style.width = '100%';
    element.style.height = '100%';
    applyElementProperties(
      element,
      GRID_PROPERTY_NAMES,
      props,
      previousPropsRef.current,
    );
    elementRef.current = element;
  }

  useImperativeHandle(forwardedRef, () => elementRef.current, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const result = applyElementProperties(
      element,
      GRID_PROPERTY_NAMES,
      props,
      previousPropsRef.current,
      pendingSourceSyncRef.current,
    );
    if (result.sourceSyncConsumed) {
      pendingSourceSyncRef.current = null;
    }
  });

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    const selectedEventNames = new Set([
      ...DEFAULT_EVENT_NAMES,
      ...normalizeEventNames(props.eventListeners),
    ]);
    const dedicatedListeners = {};
    const genericListeners = {};
    for (const eventName of selectedEventNames) {
      const dashProp = Object.prototype.hasOwnProperty.call(
        EVENT_MAPPINGS,
        eventName,
      )
        ? EVENT_MAPPINGS[eventName]
        : undefined;
      if (!dashProp) {
        genericListeners[eventName] = event => {
          sequenceRef.current += 1;
          if (props.setProps) {
            props.setProps({
              eventData: createEventEnvelope(
                eventName,
                event.detail,
                sequenceRef.current,
              ),
            });
          }
        };
        continue;
      }
      dedicatedListeners[eventName] = event => {
        sequenceRef.current += 1;
        const detail =
          eventName === 'afteredit'
            ? compactAfterEditDetail(event.detail)
            : event.detail;
        const envelope = createEventEnvelope(
          eventName,
          detail,
          sequenceRef.current,
        );
        const updates = { [dashProp]: envelope };
        if (!DEFAULT_EVENT_NAMES.includes(eventName)) {
          updates.eventData = envelope;
        }
        if (
          eventName === 'afteredit' &&
          props.syncSourceOnEdit &&
          'source' in element
        ) {
          const token = createSourceSyncToken(element.source);
          pendingSourceSyncRef.current = token;
          updates.source = token.value;
        }
        if (props.setProps) {
          props.setProps(updates);
        }
      };
    }
    const cleanupDedicated = bindEventListeners(element, dedicatedListeners);
    const cleanupGeneric = bindEventListeners(element, genericListeners);
    return () => {
      cleanupDedicated();
      cleanupGeneric();
    };
  }, [
    props.eventListeners,
    props.setProps,
    props.syncSourceOnEdit,
  ]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const element = elementRef.current;
    if (!host || !element) {
      return undefined;
    }
    host.appendChild(element);
    return () => element.remove();
  }, []);

  return React.createElement('div', {
    ref: hostRef,
    id: props.id,
    className: props.className,
    style: {
      display: 'block',
      width: '100%',
      ...props.style,
    },
  });
});

${componentName}.displayName = ${quote(componentName)};

${componentName}.propTypes = {
${propTypes}
};

${componentName}.defaultProps = {
  eventListeners: [],
  syncSourceOnEdit: false,
};

export default ${componentName};
`;
  return {
    componentName,
    fileName: `${componentName}.react.js`,
    source,
  };
}

export function resolveOutputDirectory(
  rootDir: string,
  outputDir: string,
): string {
  return path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(rootDir, outputDir);
}
