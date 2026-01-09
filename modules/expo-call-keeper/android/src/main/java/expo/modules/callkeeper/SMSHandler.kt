package expo.modules.callkeeper

import android.content.Context
import android.telephony.SmsManager

object SMSHandler {
  
  fun sendSMS(context: Context, phoneNumber: String, message: String): Boolean {
    return try {
      val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
      val antiSpamEnabled = prefs.getBoolean("@CallKeeper:antiSpamEnabled", false)
      val now = System.currentTimeMillis()
      
      // 🔍 CHECK #1: Verificar se é VIP
      val vipSet = CallKeeperService.getVipList(context)
      val isVip = vipSet.contains(phoneNumber)
      
      // 🕒 CHECK #2: Anti-Spam Logic (se ativo)
      if (antiSpamEnabled) {
        val lastSentKey = "last_sent_timestamp_$phoneNumber"
        val lastSent = prefs.getLong(lastSentKey, 0L)
        
        // Define threshold baseado no status VIP
        val threshold = if (isVip) {
          10 * 60 * 1000L  // VIP: 10 minutos
        } else {
          30 * 60 * 1000L  // Regular: 30 minutos
        }
        
        // Se enviou recentemente, BLOQUEAR
        if (lastSent > 0 && (now - lastSent) < threshold) {
          val minutesAgo = (now - lastSent) / 60000
          val status = if (isVip) "VIP (10 min)" else "Regular (30 min)"
          android.util.Log.w(
            "SMSHandler",
            "⏱️ BLOQUEADO POR ANTI-SPAM! [$status]\n" +
            "   Número: $phoneNumber\n" +
            "   Último envio: $minutesAgo min atrás\n" +
            "   Threshold: ${threshold / 60000} min"
          )
          return false  // ❌ ABORT - Não enviar
        }
      }
      
      // 📤 CHECK #3: Enviar SMS
      val smsManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        context.getSystemService(SmsManager::class.java)
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
      
      // Divide mensagens longas automaticamente
      val parts = smsManager.divideMessage(message)
      
      if (parts.size == 1) {
        smsManager.sendTextMessage(phoneNumber, null, message, null, null)
      } else {
        smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
      }
      
      // 💾 CRITICAL: SEMPRE salvar timestamp após enviar (mesmo com anti-spam OFF)
      // Razão: Se o usuário ativar o filtro depois, SMS anteriores devem ser contados
      val lastSentKey = "last_sent_timestamp_$phoneNumber"
      prefs.edit().putLong(lastSentKey, now).apply()
      
      val status = if (isVip) "VIP (10 min)" else "Regular (30 min)"
      android.util.Log.i(
        "SMSHandler",
        "✅ SMS ENVIADO! [$status]\n" +
        "   Número: $phoneNumber\n" +
        "   Anti-Spam: ${if (antiSpamEnabled) "ATIVO" else "INATIVO"}\n" +
        "   Timestamp salvo: $now"
      )
      
      true
    } catch (e: Exception) {
      android.util.Log.e("SMSHandler", "❌ ERRO ao enviar SMS: ${e.message}")
      e.printStackTrace()
      false
    }
  }
}
