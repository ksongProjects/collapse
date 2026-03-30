import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons'

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

const Select = SelectPrimitive.Root

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={joinClassNames('ui-select-trigger', className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon className="ui-select-icon">
      <ChevronDownIcon />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={joinClassNames('ui-select-content', className)}
      position={position}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="ui-select-scroll-button">
        <ChevronUpIcon />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="ui-select-viewport">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="ui-select-scroll-button">
        <ChevronDownIcon />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))

SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={joinClassNames('ui-select-item', className)}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ui-select-item-indicator">
      <CheckIcon />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
))

SelectItem.displayName = SelectPrimitive.Item.displayName

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}
