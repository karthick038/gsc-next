"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialogContext = React.createContext({})

const AlertDialog = ({ children, open: controlledOpen, onOpenChange }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : uncontrolledOpen
    const setOpen = isControlled ? onOpenChange : setUncontrolledOpen

    return (
        <AlertDialogContext.Provider value={{ open, setOpen }}>
            {children}
        </AlertDialogContext.Provider>
    )
}

const AlertDialogTrigger = ({ asChild, children, ...props }) => {
    const { setOpen } = React.useContext(AlertDialogContext)

    const handleClick = (e) => {
        setOpen(true);
        if (children.props.onClick) children.props.onClick(e);
    };

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            onClick: handleClick,
            ...props
        });
    }

    return (
        <button onClick={handleClick} {...props}>
            {children}
        </button>
    )
}

const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => {
    const { open } = React.useContext(AlertDialogContext)

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/80 animate-in fade-in-0" />

            {/* Content */}
            <div
                ref={ref}
                className={cn(
                    "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg",
                    className
                )}
                {...props}
            />
        </div>
    )
})
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({
    className,
    ...props
}) => (
    <div
        className={cn(
            "flex flex-col space-y-2 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
    className,
    ...props
}) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn("text-lg font-semibold", className)}
        {...props}
    />
))
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
AlertDialogDescription.displayName = "AlertDialogDescription"

const AlertDialogAction = React.forwardRef(({ className, onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(AlertDialogContext)
    return (
        <button
            ref={ref}
            className={cn(buttonVariants(), className)}
            onClick={(e) => {
                if (onClick) onClick(e);
                setOpen(false) // Close on action usually? Shadcn implies invalidating/proceeding.
                // Actually, Action usually proceeds. We should let user handle closing if async, 
                // but standard behavior is auto-dismiss unless prevented. 
                // For this simple case, we'll close.
            }}
            {...props}
        />
    )
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef(({ className, onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(AlertDialogContext)
    return (
        <button
            ref={ref}
            className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-2 sm:mt-0",
                className
            )}
            onClick={(e) => {
                if (onClick) onClick(e);
                setOpen(false)
            }}
            {...props}
        />
    )
})
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
}
