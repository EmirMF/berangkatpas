import { useState } from 'react';

export default function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const setValue = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleChange = (field) => (value) => setValue(field, value);

  const handleSubmit = (onValid) => () => {
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onValid(values);
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
  };

  return { values, errors, setValue, handleChange, handleSubmit, reset };
}
