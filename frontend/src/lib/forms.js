export const blurValidation = (form) => ({
  validateTrigger: 'onBlur',
  onValuesChange: (changed) => {
    const names = Object.keys(changed).filter((name) => form.getFieldError(name).length)
    if (names.length) form.setFields(names.map((name) => ({ name, errors: [] })))
  },
})
