/**
 * Form Validation Hook
 * Professional validation with real-time feedback
 */

import { useState, useCallback, useMemo, type ChangeEvent } from "react";

// Validation rules
export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export interface FieldConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: ValidationRule;
  email?: boolean;
  password?: boolean;
  match?: {
    field: string;
    label: string;
  };
}

export interface FieldState {
  value: string;
  error: string | null;
  touched: boolean;
  isValid: boolean;
  isValidating: boolean;
}

export interface UseFormValidationOptions {
  fields: Record<string, FieldConfig>;
  onSubmit?: (values: Record<string, string>) => Promise<void> | void;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
}

// Common validation rules
export const validationRules = {
  required: (message = "Trường này là bắt buộc / This field is required"): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  email: (message = "Email không hợp lệ / Invalid email address"): ValidationRule => ({
    validate: (value) => {
      if (!value) return true; // Let required handle empty
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message,
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    validate: (value) => !value || value.length >= length,
    message: message || `Ít nhất ${length} ký tự / At least ${length} characters`,
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    validate: (value) => !value || value.length <= length,
    message: message || `Tối đa ${length} ký tự / At most ${length} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => !value || regex.test(value),
    message,
  }),

  password: (): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
    },
    message: "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số / Password must be at least 8 characters with uppercase, lowercase and number",
  }),

  passwordMatch: (confirmValue: string, fieldLabel: string): ValidationRule => ({
    validate: (value) => !value || value === confirmValue,
    message: `Mật khẩu xác nhận không khớp / ${fieldLabel} confirmation does not match`,
  }),
};

export function useFormValidation(options: UseFormValidationOptions) {
  const { fields, onSubmit, validateOnBlur = true, validateOnChange = false } = options;

  // Initialize field states
  const initialStates: Record<string, FieldState> = useMemo(() => {
    const states: Record<string, FieldState> = {};
    Object.keys(fields).forEach((fieldName) => {
      states[fieldName] = {
        value: "",
        error: null,
        touched: false,
        isValid: false,
        isValidating: false,
      };
    });
    return states;
  }, [fields]);

  const [states, setStates] = useState<Record<string, FieldState>>(initialStates);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate a single field
  const validateField = useCallback(
    (fieldName: string, value: string, allValues?: Record<string, string>): string | null => {
      const config = fields[fieldName];
      if (!config) return null;

      // Required check
      if (config.required && !value.trim()) {
        return "Trường này là bắt buộc / This field is required";
      }

      // Skip other validations if empty and not required
      if (!value && !config.required) {
        return null;
      }

      // Min length
      if (config.minLength && value.length < config.minLength) {
        return `Ít nhất ${config.minLength} ký tự / At least ${config.minLength} characters`;
      }

      // Max length
      if (config.maxLength && value.length > config.maxLength) {
        return `Tối đa ${config.maxLength} ký tự / At most ${config.maxLength} characters`;
      }

      // Email
      if (config.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return "Email không hợp lệ / Invalid email address";
        }
      }

      // Password strength
      if (config.password) {
        if (value.length < 8) {
          return "Mật khẩu phải có ít nhất 8 ký tự / Password must be at least 8 characters";
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return "Mật khẩu cần chữ hoa, chữ thường và số / Password needs uppercase, lowercase and number";
        }
      }

      // Pattern
      if (config.pattern && !config.pattern.test(value)) {
        return config.patternMessage || "Giá trị không hợp lệ / Invalid value";
      }

      // Custom validation
      if (config.custom && !config.custom.validate(value)) {
        return config.custom.message;
      }

      // Match field (e.g., password confirmation)
      if (config.match && allValues) {
        const matchValue = allValues[config.match.field];
        if (value !== matchValue) {
          return `${config.match.label} không khớp / ${config.match.label} does not match`;
        }
      }

      return null;
    },
    [fields]
  );

  // Handle field change
  const handleChange = useCallback(
    (fieldName: string) => (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setStates((prev) => {
        const existingState = prev[fieldName];
        const newState: Record<string, FieldState> = { ...prev };
        newState[fieldName] = {
          value,
          error: existingState?.error ?? null,
          touched: existingState?.touched ?? false,
          isValid: existingState?.isValid ?? false,
          isValidating: existingState?.isValidating ?? false,
        };
        return newState;
      });

      // Validate on change if enabled
      if (validateOnChange) {
        setStates((prev) => {
          const allValues = Object.fromEntries(
            Object.entries(prev).map(([k, v]) => [k, v.value])
          );
          const error = validateField(fieldName, value, allValues);
          const existingState = prev[fieldName];
          const newState: Record<string, FieldState> = { ...prev };
          newState[fieldName] = {
            value,
            error: error ?? null,
            touched: existingState?.touched ?? false,
            isValid: !error,
            isValidating: existingState?.isValidating ?? false,
          };
          return newState;
        });
      }
    },
    [validateField, validateOnChange]
  );

  // Handle field blur
  const handleBlur = useCallback(
    (fieldName: string) => () => {
      setStates((prev) => {
        const existingState = prev[fieldName];
        const value = existingState?.value ?? "";
        const allValues = Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, v.value])
        );
        const error = validateField(fieldName, value, allValues);
        const newState: Record<string, FieldState> = { ...prev };
        newState[fieldName] = {
          value,
          error: error ?? null,
          touched: true,
          isValid: !error,
          isValidating: existingState?.isValidating ?? false,
        };
        return newState;
      });
    },
    [validateField]
  );

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const allValues = Object.fromEntries(
      Object.entries(states).map(([k, v]) => [k, v.value])
    );

    let isValid = true;
    const newStates: Record<string, FieldState> = {};

    Object.keys(fields).forEach((fieldName) => {
      const existingState = states[fieldName];
      const value = existingState?.value ?? "";
      const error = validateField(fieldName, value, allValues);

      newStates[fieldName] = {
        value,
        error: error ?? null,
        touched: true,
        isValid: !error,
        isValidating: existingState?.isValidating ?? false,
      };

      if (error) isValid = false;
    });

    setStates(newStates);
    return isValid;
  }, [fields, states, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const isValid = validateAll();
      if (!isValid) return;

      setIsSubmitting(true);
      try {
        const values = Object.fromEntries(
          Object.entries(states).map(([k, v]) => [k, v.value])
        );
        await onSubmit?.(values);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Đã xảy ra lỗi / An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [states, validateAll, onSubmit]
  );

  // Reset form
  const reset = useCallback(() => {
    setStates(initialStates);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [initialStates]);

  // Get field props for input
  const getFieldProps = useCallback(
    (fieldName: string) => {
      const state = states[fieldName];
      return {
        name: fieldName,
        value: state?.value ?? "",
        onChange: handleChange(fieldName),
        onBlur: validateOnBlur ? handleBlur(fieldName) : undefined,
        error: state?.touched ? state.error : undefined,
        isValid: state?.touched && state?.isValid,
      };
    },
    [states, handleChange, handleBlur, validateOnBlur]
  );

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return Object.values(states).every((state) => {
      const config = fields[Object.keys(fields).find(
        (k) => fields[k] === fields[Object.keys(states).find((sk) => states[sk] === state)!]
      )!];
      // If field is required, it must be valid
      if (config?.required) return state.isValid && state.value.trim().length > 0;
      // If not required and empty, it's valid
      if (!state.value) return true;
      // Otherwise check validation
      return state.isValid;
    });
  }, [states, fields]);

  // Check if form has been modified
  const isDirty = useMemo(() => {
    return Object.values(states).some((state) => state.value.length > 0);
  }, [states]);

  return {
    states,
    isSubmitting,
    submitError,
    isFormValid,
    isDirty,
    handleSubmit,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    getFieldProps,
    setStates,
  };
}
