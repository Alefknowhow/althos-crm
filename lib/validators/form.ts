import { z } from 'zod'

export function buildFormSchema(formSchemaJson: any) {
  const shape: any = {}
  
  if (!formSchemaJson || !formSchemaJson.fields) return z.object({})

  formSchemaJson.fields.forEach((field: any) => {
    let fieldSchema: any = z.string()
    
    if (field.type === 'email') {
      fieldSchema = z.string().email("E-mail inválido")
    } else if (field.type === 'number') {
      fieldSchema = z.coerce.number({ error: "Apenas números" })
    } else if (field.type === 'checkbox') {
      // Quando um checkbox vem num formData, se marcado ele envia "on", senao undefined
      fieldSchema = z.boolean().or(z.literal('on').transform(() => true)).or(z.literal(undefined).transform(() => false))
    } else if (field.type === 'multi_select') {
      fieldSchema = z.array(z.string()).or(z.string().transform(v => [v]))
    } else if (field.type === 'single_choice') {
      fieldSchema = z.string()
    }

    if (!field.required) {
      if (field.type === 'checkbox') {
        fieldSchema = fieldSchema.optional()
      } else if (field.type === 'multi_select') {
        fieldSchema = fieldSchema.optional()
      } else {
        fieldSchema = fieldSchema.optional().or(z.literal(''))
      }
    } else {
      if (field.type === 'checkbox') {
        fieldSchema = fieldSchema.refine((val: any) => val === true, "Campo obrigatório")
      } else if (field.type !== 'number' && field.type !== 'multi_select') {
        fieldSchema = fieldSchema.min(1, "Campo obrigatório")
      }
    }

    shape[field.id] = fieldSchema
  })

  return z.object(shape)
}
