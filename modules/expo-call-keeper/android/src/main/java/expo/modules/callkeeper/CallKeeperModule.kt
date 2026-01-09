package expo.modules.callkeeper

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallKeeperModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CallKeeper")

    Function("startService") { message: String, delayMinutes: Int ->
      val context = appContext.reactContext ?: return@Function false
      CallKeeperService.start(context, message, delayMinutes)
      return@Function true
    }

    Function("stopService") {
      val context = appContext.reactContext ?: return@Function false
      CallKeeperService.stop(context)
      return@Function true
    }

    Function("sendSMS") { phoneNumber: String, message: String ->
      val context = appContext.reactContext ?: return@Function false
      return@Function SMSHandler.sendSMS(context, phoneNumber, message)
    }

    Function("isServiceRunning") {
      val context = appContext.reactContext ?: return@Function false
      return@Function CallKeeperService.isRunning(context)
    }
    
    Function("setIgnoreContacts") { ignore: Boolean ->
      val context = appContext.reactContext ?: return@Function false
      CallKeeperService.setIgnoreContacts(context, ignore)
      return@Function true
    }
    
    Function("setBlacklist") { numbers: List<String> ->
      val context = appContext.reactContext ?: return@Function false
      CallKeeperService.setBlacklist(context, numbers.toSet())
      return@Function true
    }
    
    Function("getBlacklist") {
      val context = appContext.reactContext ?: return@Function emptyList<String>()
      return@Function CallKeeperService.getBlacklist(context).toList()
    }
    
    Function("setVipList") { numbers: List<String> ->
      val context = appContext.reactContext ?: return@Function false
      CallKeeperService.setVipList(context, numbers.toSet())
      return@Function true
    }
    
    Function("getVipList") {
      val context = appContext.reactContext ?: return@Function emptyList<String>()
      return@Function CallKeeperService.getVipList(context).toList()
    }
    
    // 📊 Obter histórico de SMS (formato: timestamp|número|template)
    Function("getSmsHistory") {
      val context = appContext.reactContext ?: return@Function ""
      val prefs = context.getSharedPreferences("clients_logs", Context.MODE_PRIVATE)
      return@Function prefs.getString("sms_history", "") ?: ""
    }
    
    // 🕒 Ativar/desativar filtro anti-spam
    Function("setAntiSpamEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
      prefs.edit().putBoolean("@CallKeeper:antiSpamEnabled", enabled).apply()
      android.util.Log.d("CallKeeper", "🕒 Anti-Spam ${if(enabled) "ATIVADO" else "DESATIVADO"}")
      return@Function true
    }
    
    // 🕒 Obter estado do anti-spam
    Function("getAntiSpamEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
      return@Function prefs.getBoolean("@CallKeeper:antiSpamEnabled", false)
    }
    
    // 📝 Salvar índice do template ativo (0=A, 1=B, 2=C)
    Function("setActiveTemplateIndex") { index: Int ->
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
      prefs.edit().putInt("@CallKeeper:activeTemplateIndex", index).apply()
      android.util.Log.d("CallKeeper", "📝 Template ativo: $index")
      return@Function true
    }
  }
}
