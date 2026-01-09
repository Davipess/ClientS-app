package expo.modules.callkeeper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager
import android.util.Log

class CallReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        try {
            // LOG CRÍTICO PARA DEBUG
            Log.d("CallKeeper", "📢 BROADCAST RECEBIDO: ${intent.action}")
            
            if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
                val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                
                Log.d("CallKeeper", "📱 Estado: $state, Número: ${number ?: "null"}")
                
                when (state) {
                    TelephonyManager.EXTRA_STATE_RINGING -> {
                        Log.d("CallKeeper", "🔔 CHAMADA A TOCAR!")
                        // Garante que o serviço está ativo
                        if (!CallKeeperService.isRunning(context)) {
                            Log.d("CallKeeper", "⚠️ Serviço não estava ativo. A iniciar...")
                            // Pode iniciar o serviço aqui se necessário
                        }
                        
                        // Passa os dados para o Serviço
                        val serviceIntent = Intent(context, CallKeeperService::class.java).apply {
                            action = "PHONE_STATE_CHANGED"
                            putExtra("state", state)
                            putExtra("number", number)
                        }
                        
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            context.startForegroundService(serviceIntent)
                        } else {
                            context.startService(serviceIntent)
                        }
                    }
                    
                    TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                        Log.d("CallKeeper", "📞 CHAMADA ATENDIDA")
                        // Notifica o serviço
                        val serviceIntent = Intent(context, CallKeeperService::class.java).apply {
                            action = "PHONE_STATE_CHANGED"
                            putExtra("state", state)
                        }
                        context.startService(serviceIntent)
                    }
                    
                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        Log.d("CallKeeper", "📴 CHAMADA TERMINADA")
                        // Notifica o serviço
                        val serviceIntent = Intent(context, CallKeeperService::class.java).apply {
                            action = "PHONE_STATE_CHANGED"
                            putExtra("state", state)
                        }
                        context.startService(serviceIntent)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CallKeeper", "❌ ERRO no CallReceiver: ${e.message}", e)
            // Não fazer crash - apenas logar o erro
        }
    }
}
