import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface DifficultyOption {
  value: string
  label: string
}

interface DifficultySelectProps {
  label: string
  value: string
  summary: string
  options: readonly DifficultyOption[]
  onValueChange: (value: string) => void
  onApply: () => void
  applyDisabled: boolean
}

export function DifficultySelect({
  label,
  value,
  summary,
  options,
  onValueChange,
  onApply,
  applyDisabled,
}: DifficultySelectProps) {
  return (
    <div className="setup-field">
      <p className="field-label">{label}</p>
      <div className="setup-row">
        <div className="setup-select-wrap">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger aria-label={label}>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          className="button setup-apply-button"
          type="button"
          onClick={onApply}
          disabled={applyDisabled}
        >
          Apply
        </button>
      </div>
      <p className="difficulty-summary">{summary}</p>
    </div>
  )
}
