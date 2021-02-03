
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

(function(window: Window)
{
    function ctor({ select, extend, getData, setData, addClass, removeClass }: ConstructorArgs): X
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

            const parts = stringInput.split("(");
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
                selector: "[x-toggle]",
                get: "getAttribute(x-toggle)",
                attach: "click",
                handlerFactory: ({ element, expr }: DirectiveFactoryArgs) =>
                {
                    return () =>
                    {
                        let value = !getData(element, expr);
                        setData(element, expr, value);

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
            addClass: (e, s) => jQuery(e).addClass(s),
            removeClass: (e, s) => jQuery(e).removeClass(s)
        });
    }
    else
    {
        throw new Error("currently only jQuery is supported");
    }

})(this);

