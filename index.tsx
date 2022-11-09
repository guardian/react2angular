import { IAugmentedJQuery, IComponentOptions } from 'angular'
import fromPairs = require('lodash.frompairs')
import NgComponent from 'ngcomponent'
import * as React from 'react'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { render, unmountComponentAtNode } from 'react-dom'

/**
 * Wraps a React component in Angular. Returns a new Angular component.
 *
 * Usage:
 *
 *   ```ts
 *   type Props = { foo: number }
 *   class ReactComponent extends React.Component<Props, S> {}
 *   const AngularComponent = react2angular(ReactComponent, ['foo'])
 *   ```
 */
export function react2angular<Props>(
  Class: React.ComponentType<Props>,
  bindingNames: (keyof Props)[] | null = null,
  injectNames: string[] = []
): IComponentOptions {
  const names = bindingNames
    || (Class.propTypes && Object.keys(Class.propTypes) as (keyof Props)[])
    || []

  return {
    bindings: fromPairs(names.map(_ => [_, '<'])),
    controller: ['$element', ...injectNames, class extends NgComponent<Props> {
      static get $$ngIsClass() {
        return true
      }
      isDestroyed = false
      injectedProps: { [name: string]: any }
      constructor(private $element: IAugmentedJQuery, ...injectedProps: any[]) {
        super()
        this.injectedProps = {}
        injectNames.forEach((name, i) => {
          this.injectedProps[name] = injectedProps[i]
        })
      }
      render() {
        if (!this.isDestroyed) {
          render(
            <Class {...this.props} {...this.injectedProps as any} />,
            this.$element[0]
          )
        }
      }
      componentWillUnmount() {
        this.isDestroyed = true
        unmountComponentAtNode(this.$element[0])
      }
    }]
  }
}

/**
 * Creates a store to allow state within React to be programmatically updated
 * outside of a React context.
 */
export const createStore = <Value extends unknown>(initialValue: Value): { update: (val: Value) => boolean, Store: Store<Value> } => {
  type Subscription = (val: Value) => void

  const subscribers: Subscription[] = []

  const store = {
    currentValue: initialValue,

    /**
     * Get the current value of the store.
     */
    getValue: () => store.currentValue,

    /**
     * Update the value in the store, informing subscribers.
     *
     * @return {boolean} true if there are any subscribers, false if not.
     */
    update: (val: Value): boolean => {
      store.currentValue = val
      subscribers.forEach((sub) => sub(store.getValue()))
      return subscribers.length ? true : false
    },

    /**
     * Subscribe to store updates.
     */
    subscribe: (sub: Subscription) => subscribers.push(sub),

    /**
     * Unsubscribe to store updates.
     */
    unsubscribe: (sub: Subscription) => {
      const subToRemove = subscribers.findIndex(
        (currentSub) => currentSub === sub
      )
      subscribers.splice(subToRemove, 1)
    }
  }

  /**
   * The Store component takes a single function as a child component, and calls it
   * with the store value. It will call this function every time the store value is
   * updated, rerendering its children.
   *
   * Example usage:
   *
   * ```tsx
   * <Store>
   *   {(value) =>
   *      <div>{value}</div>
   *   }
   * </Store>
   * ```
   */
  const Store = ({ children }: { children: (val: Value) => ReactElement }) => {
    const [value, setValue] = useState(store.getValue())
    useEffect(() => {
      store.subscribe(setValue)
      return () => store.unsubscribe(setValue)
    }, [])

    return children(value)
  }

  return { update: store.update, Store }
}

export type Store<Value> = (props: {
  children: (val: Value) => ReactElement;
}) => ReactElement
