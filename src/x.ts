
export type Expression = string;
export type ExpressionFactory = () => Expression;

export interface Invocation
{
    func: Expression;
    params: any[];
}

export interface X
{
    <T = any>(additionalState: (T | Array<T>)): X;

    parseInvoke(input: Expression | ExpressionFactory, args?: any[] | any): Invocation;

    invoke<TResult = any>(target: HTMLElement, input: Expression | ExpressionFactory | Invocation, args?: any[]): TResult;
}

export interface ConstructorArgs
{
    select(selector: string): HTMLElement[];
    extend(target: any, ...objectN: any[]): any;
    getData(element: HTMLElement, key?: string): any | undefined;
    setData(element: HTMLElement, key: string, value: any | undefined): any;
    hasClass(element: HTMLElement, classes: string): boolean;
    addClass(element: HTMLElement, classes: string): void;
    removeClass(element: HTMLElement, classes: string): void;
}

export interface Directive
{
    selector: string;
    get: string | ExpressionFactory;
    attach: string | string[],
    handlerFactory(factoryArgs: DirectiveFactoryArgs): (e: Event) => void;
}

export interface DirectiveFactoryArgs
{
    directive: Directive;
    element: HTMLElement;
    expr: Expression;
}

export interface Window
{
    x: X;
}

class Defer
{
    constructor()
    {
        this.resolve = function() { };
        this.reject = function() { };

        this._p = new Promise((resolve, reject) =>
        {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    then(onSuccess, onError)
    {
        this._p.then(onSuccess, onError);
    }
}

(function(window: Window)
{
    function ctor({ select, extend, hasClass, addClass, removeClass }: ConstructorArgs): X
    {
        const x = <T = any>(additionalState: (T | Array<T>)): X =>
        {
            let arrayState = additionalState as Array<T>;
            if (arrayState !== undefined)
                extend(x.state, ...arrayState);
            else
                extend(x.state, additionalState);

            return x;
        };

        x.version = "1.0.0";
        x.state = {};

        function tryConvert(val: any, args?: any[] | any): any
        {
            val = (val || "").trim();

            if (val.indexOf && val.indexOf("'") === 0)
            {
                return val.substr(1, val.length - 2);
            }

            const intAttempt = parseInt(val);
            if (!isNaN(intAttempt))
            {
                return intAttempt;
            }

            if (args !== undefined && args[val] !== undefined)
            {
                return args[val];
            }

            if (x.state[val] !== undefined)
            {
                return x.state[val];
            }

            if (val === undefined || val === null || val === "false" || val === "")
            {
                return false;
            }

            return val;
        }

        x.parseInvoke = (input: Expression | ExpressionFactory, args?: any[] | any): Invocation =>
        {
            let stringInput = input as string;
            if (stringInput === undefined)
            {
                const factory = input as ExpressionFactory;
                if (factory !== undefined)
                    stringInput = factory();
            }

            if (!stringInput || !stringInput.length)
                throw new Error("input expression is required");

            const parts = stringInput.trim().split("(");
            const func = parts[0];

            let params = [];
            if (parts.length >= 2)
            {
                params = parts[1].substr(0, parts[1].lastIndexOf(")")).split(",");
            }

            for (let index = 0; index < params.length; index++)
            {
                params[index] = tryConvert(params[index], args);
            }

            return {
                func,
                params
            };
        };

        x.invoke = <TResult = any>(target: HTMLElement, input: Expression | ExpressionFactory | Invocation, args?: any[]): TResult =>
        {
            let invoke = input as Invocation;
            if (invoke === undefined)
            {
                invoke = x.parseInvoke(input as string, args);
            }

            return target[invoke.func](...invoke.params);
        };

        const directives = new Array<Directive>(
            {   // x-toggle="cssClass" 
                // x-toggle="on(shown.bs.collapse,hidden.bs.collapse) select(.show-filter-btn) shown"
                selector: "[x-toggle]",
                get: "getAttribute(x-toggle)",
                attach: "click",
                handlerFactory: ({ element, expr }: DirectiveFactoryArgs) =>
                {
                    return () =>
                    {
                        const parts = expr.match(/(([^(])+(\([^)]+\))?)*/);

                        let value = !hasClass(element, expr);
                        if (value)
                            addClass(element, expr);
                        else
                            removeClass(element, expr);
                    };
                }
            },
            {   // x-click="filter(somedata)"
                selector: "[x-click]",
                get: "getAttribute(x-click)",
                attach: "click",
                handlerFactory: function({ element, expr })
                {
                    return (ev) =>
                    {
                        const invoke = x.parseInvoke(expr, { ev, element });
                        if (x.state[invoke.func])
                        {
                            x.state[invoke.func](...invoke.params);
                        }
                    };
                }
            });

        // this only accounts for DOM elements present when the page loads. how to handle dynamically added elements, 
        // such as in a AJAX load?
        for (const d of directives)
        {
            for (const element of select(d.selector))
            {
                const expr = x.invoke(element, d.get);

                let events = d.attach as string[];
                if (events === undefined)
                {
                    events = (d.attach as string)?.split(",");
                }

                for (const eventType of events)
                {
                    element.addEventListener(eventType, d.handlerFactory({ directive: d, element, expr }));
                }
            }
        }

        return x;
    }

    if (jQuery)
    {
        window.x = ctor({
            select: (input) => jQuery.makeArray(jQuery(input)),
            extend: jQuery.extend,
            getData: (e, k) => jQuery(e).data(k),
            setData: (e, k, v) => jQuery(e).data(k, v),
            hasClass: (e, s) => jQuery(e).hasClass(s),
            addClass: (e, s) => jQuery(e).addClass(s),
            removeClass: (e, s) => jQuery(e).removeClass(s)
        });
    }
    else
    {
        throw new Error("currently only jQuery is supported");
    }

})(this);

