import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, ...props }, ref) => (
    <div className="w-full min-w-0">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full min-w-0 px-3 py-2.5 rounded-xl border text-sm bg-white transition-all duration-150 outline-none',
          'focus:ring-2 focus:border-transparent',
          error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200',
          className
        )}
        style={{ fontSize: '16px' }} /* evita zoom iOS */
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-3 rounded-xl border text-sm bg-white transition-all duration-150 outline-none resize-none',
          'focus:ring-2 focus:border-transparent',
          error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200',
          className
        )}
        style={{ fontSize: '16px' }}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-3 rounded-xl border text-sm bg-white transition-all duration-150 outline-none appearance-none',
          error ? 'border-red-400' : 'border-gray-200',
          className
        )}
        style={{ fontSize: '16px' }}
        {...props}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
