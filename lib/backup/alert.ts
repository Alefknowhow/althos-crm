/**
 * Alerta por e-mail em falha de backup — só dispara em falha/checksum
 * inválido/atraso, nunca em sucesso (evita fadiga de alerta). Reaproveita
 * lib/resend.ts (já usado no resto do projeto), sem dependência nova.
 */

import { getResend, EMAIL_FROM } from '@/lib/resend'

export async function sendBackupAlert(subject: string, message: string): Promise<void> {
  const to = process.env.BACKUP_ALERT_EMAIL
  if (!to) {
    console.error('[backup] BACKUP_ALERT_EMAIL não configurado — alerta não enviado:', subject)
    return
  }
  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject: `[Althos Backup] ${subject}`,
      text: message,
    })
  } catch (e: any) {
    // Falha ao alertar não pode derrubar o job de backup em si — só loga.
    console.error('[backup] falha ao enviar alerta por e-mail:', e?.message)
  }
}
