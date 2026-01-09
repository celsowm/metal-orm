import type { ParamNode } from './expression-nodes.js';

export type ParamProxy = ParamNode & {
  [key: string]: ParamProxy;
};

export type ParamProxyRoot = {
  [key: string]: ParamProxy;
};

const buildParamProxy = (name: string): ParamProxy => {
  const target: ParamNode = { type: 'Param', name };
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') {
        return Reflect.get(t, prop, receiver);
      }
      if (typeof prop === 'string' && prop.startsWith('$')) {
        const trimmed = prop.slice(1);
        const nextName = name ? `${name}.${trimmed}` : trimmed;
        return buildParamProxy(nextName);
      }
      if (prop in t && name === '') {
        return (t as unknown as Record<string, unknown>)[prop];
      }
      const nextName = name ? `${name}.${prop}` : prop;
      return buildParamProxy(nextName);
    }
  }) as ParamProxy;
};

export const createParamProxy = (): ParamProxyRoot => {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') {
        return Reflect.get(t, prop, receiver);
      }
      if (typeof prop === 'string' && prop.startsWith('$')) {
        return buildParamProxy(prop.slice(1));
      }
      return buildParamProxy(String(prop));
    }
  }) as ParamProxyRoot;
};
