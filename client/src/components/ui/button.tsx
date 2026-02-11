import * as React from "react";

const buttonVariants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-gray-300 bg-white hover:bg-gray-100 text-gray-700",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
    ghost: "hover:bg-gray-100 text-gray-700",
    link: "text-blue-600 underline-offset-4 hover:underline",
};

const buttonSizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof buttonVariants;
    size?: keyof typeof buttonSizes;
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "default", size = "default", asChild = false, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

        const variantClass = buttonVariants[variant] || buttonVariants.default;
        const sizeClass = buttonSizes[size] || buttonSizes.default;

        const combinedClassName = `${baseStyles} ${variantClass} ${sizeClass} ${className}`;

        if (asChild && React.isValidElement(props.children)) {
            const child = React.Children.only(props.children) as React.ReactElement;
            return React.cloneElement(child, {
                // @ts-ignore
                className: `${child.props.className || ""} ${combinedClassName}`,
                ...props,
                // @ts-ignore
                ref,
            });
        }

        return (
            <button
                className={combinedClassName}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
