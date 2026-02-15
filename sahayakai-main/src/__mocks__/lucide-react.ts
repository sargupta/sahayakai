import React from 'react';

console.log('Mock lucide-react (ForwardRef Proxy) loaded');

const iconProxy = new Proxy({}, {
    get: (target: any, name: string | symbol) => {
        if (name === '__esModule') return true;

        const componentName = name.toString();

        if (componentName === 'default') {
            const DefaultComponent = React.forwardRef((props: any, ref: any) =>
                React.createElement('div', { ...props, ref, 'data-testicon': 'DefaultIcon' })
            );
            return DefaultComponent;
        }

        const IconComponent = React.forwardRef((props: any, ref: any) =>
            React.createElement('div', { ...props, ref, 'data-testicon': componentName })
        );

        // @ts-ignore
        IconComponent.displayName = componentName;
        return IconComponent;
    }
});

module.exports = iconProxy;
