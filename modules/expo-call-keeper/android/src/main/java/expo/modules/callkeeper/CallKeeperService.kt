package expo.modules.callkeeper

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.ContactsContract
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import android.os.Handler
import android.os.Looper

class CallKeeperService : Service() {

  private lateinit var telephonyManager: TelephonyManager
  private var phoneStateListener: PhoneStateListener? = null
  private var telephonyCallback: TelephonyCallback? = null
  
  private var lastCallState = TelephonyManager.CALL_STATE_IDLE
  private var incomingNumber: String? = null
  private var callStartTime: Long = 0
  private val handler = Handler(Looper.getMainLooper())

  companion object {
    private const val NOTIFICATION_ID = 1001
    private const val CHANNEL_ID = "CallKeeperChannel"
    private const val PREFS_NAME = "CallKeeperPrefs"
    private const val KEY_IGNORE_CONTACTS = "ignoreContacts"
    private const val KEY_BLACKLIST = "blacklist"
    private const val KEY_VIP_LIST = "vipList"
    private const val KEY_SERVICE_ENABLED = "serviceEnabled"
    private var isServiceRunning = false
    
    var autoMessage: String = "Olá! Não consigo atender agora. Ligo-lhe assim que possível."
    var delayMinutes: Int = 2

    fun start(context: Context, message: String, delay: Int) {
      autoMessage = message
      delayMinutes = delay
      
      // ✅ Mark service as enabled in SharedPreferences
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(KEY_SERVICE_ENABLED, true).apply()
      
      val intent = Intent(context, CallKeeperService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      // 🛑 Mark service as disabled in SharedPreferences FIRST
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(KEY_SERVICE_ENABLED, false).apply()
      android.util.Log.d("CallKeeper", "🛑 Serviço marcado como DESATIVADO em SharedPreferences")
      
      // Stop the service
      val intent = Intent(context, CallKeeperService::class.java)
      val stopped = context.stopService(intent)
      android.util.Log.d("CallKeeper", "🛑 stopService() retornou: $stopped")
    }

    fun isRunning(context: Context): Boolean {
      return isServiceRunning
    }
    
    fun setIgnoreContacts(context: Context, ignore: Boolean) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(KEY_IGNORE_CONTACTS, ignore).apply()
      android.util.Log.d("CallKeeper", "⚙️ Ignorar contactos salvos: $ignore")
    }
    
    fun setBlacklist(context: Context, numbers: Set<String>) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putStringSet(KEY_BLACKLIST, numbers).apply()
      android.util.Log.d("CallKeeper", "🚫 Blacklist atualizada: ${numbers.size} números")
    }
    
    fun getBlacklist(context: Context): Set<String> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return prefs.getStringSet(KEY_BLACKLIST, emptySet()) ?: emptySet()
    }
    
    fun setVipList(context: Context, numbers: Set<String>) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putStringSet(KEY_VIP_LIST, numbers).apply()
      android.util.Log.d("CallKeeper", "🌟 VIP List atualizada: ${numbers.size} números")
    }
    
    fun getVipList(context: Context): Set<String> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return prefs.getStringSet(KEY_VIP_LIST, emptySet()) ?: emptySet()
    }
    
    private fun getPrefs(context: Context): SharedPreferences {
      return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
  }
  
  // 📊 LOG SMS ACTIVITY: Save to SharedPreferences (formato: timestamp|número|template)
  // Esta função precisa estar FORA do companion object para acessar applicationContext
  private fun logSmsToSharedPrefs(phoneNumber: String, templateIndex: Int) {
    try {
      val sharedPrefs = applicationContext.getSharedPreferences("clients_logs", Context.MODE_PRIVATE)
      val editor = sharedPrefs.edit()
      
      // Determinar letra do template
      val template = when(templateIndex) {
        0 -> "A"
        1 -> "B"
        2 -> "C"
        else -> "A"
      }
      
      // Formato: timestamp|número|template
      val timestamp = System.currentTimeMillis()
      val logEntry = "$timestamp|$phoneNumber|$template"
      
      // Ler logs existentes
      val currentLogs = sharedPrefs.getString("sms_history", "") ?: ""
      
      // Adicionar novo log no início
      val newLogs = if (currentLogs.isEmpty()) {
        logEntry
      } else {
        "$logEntry\n$currentLogs"
      }
      
      // Limitar a 100 linhas (manter últimas 100 entradas)
      val lines = newLogs.split("\n").take(100).joinToString("\n")
      
      // Salvar
      editor.putString("sms_history", lines)
      editor.apply()
      
      android.util.Log.d("CallKeeper", "📊 SMS logged: $phoneNumber | Template $template")
      android.util.Log.d("CallKeeper", "📊 Log format: $logEntry")
      
    } catch (e: Exception) {
      android.util.Log.e("CallKeeper", "❌ Error logging SMS: ${e.message}", e)
    }
  }

  override fun onCreate() {
    super.onCreate()
    android.util.Log.d("CallKeeper", "🚀 SERVIÇO INICIADO (onCreate)")
    android.util.Log.d("CallKeeper", "📍 Android API Level: ${Build.VERSION.SDK_INT}")
    android.util.Log.d("CallKeeper", "📝 Mensagem: \"${autoMessage.take(30)}...\"")
    android.util.Log.d("CallKeeper", "⏱️ Delay: $delayMinutes minutos")
    
    createNotificationChannel()
    
    // Android 14+ (API 34+) requer especificar o tipo explicitamente
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID, 
        createNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
      android.util.Log.d("CallKeeper", "✅ Foreground Service iniciado com tipo DATA_SYNC (Android 14+)")
    } else {
      startForeground(NOTIFICATION_ID, createNotification())
      android.util.Log.d("CallKeeper", "✅ Foreground Service iniciado (Android <14)")
    }
    
    telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    android.util.Log.d("CallKeeper", "📡 TelephonyManager obtido")
    
    setupCallListener()
    isServiceRunning = true
    android.util.Log.d("CallKeeper", "✅ Listener registado - A ouvir chamadas...")
  }
  
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      android.util.Log.d("CallKeeper", "🔄 onStartCommand - action: ${intent?.action}")
      
      // Processar intents do BroadcastReceiver
      if (intent?.action == "PHONE_STATE_CHANGED") {
        val state = intent.getStringExtra("state")
        val number = intent.getStringExtra("number")
        
        android.util.Log.d("CallKeeper", "📞 Recebido do BroadcastReceiver - Estado: $state, Número: $number")
        
        // Atualizar o número se fornecido
        if (!number.isNullOrEmpty()) {
          incomingNumber = number
        }
        
        // Mapear estado para TelephonyManager constant
        val callState = when (state) {
          TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
          TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
          TelephonyManager.EXTRA_STATE_IDLE -> TelephonyManager.CALL_STATE_IDLE
          else -> -1
        }
        
        if (callState != -1) {
          handleCallStateChange(callState)
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("CallKeeper", "❌ ERRO em onStartCommand: ${e.message}", e)
    }
    
    return START_STICKY
  }

  private fun setupCallListener() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // Android 12+ (API 31+)
      android.util.Log.d("CallKeeper", "📱 Usando TelephonyCallback (Android 12+)")
      telephonyCallback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
          android.util.Log.d("CallKeeper", "🔔 TelephonyCallback.onCallStateChanged disparou!")
          handleCallStateChange(state)
        }
      }
      telephonyManager.registerTelephonyCallback(mainExecutor, telephonyCallback!!)
      android.util.Log.d("CallKeeper", "✅ TelephonyCallback registado")
    } else {
      // Android 11 e anteriores
      android.util.Log.d("CallKeeper", "📱 Usando PhoneStateListener (Android <12)")
      phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
          android.util.Log.d("CallKeeper", "🔔 PhoneStateListener.onCallStateChanged disparou!")
          if (phoneNumber != null && phoneNumber.isNotEmpty()) {
            incomingNumber = phoneNumber
          }
          handleCallStateChange(state)
        }
      }
      @Suppress("DEPRECATION")
      telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
      android.util.Log.d("CallKeeper", "✅ PhoneStateListener registado")
    }
  }

  private fun handleCallStateChange(state: Int) {
    try {
      android.util.Log.d("CallKeeper", "Estado mudou para: $state")
      
      when (state) {
        TelephonyManager.CALL_STATE_RINGING -> {
          // Chamada a tocar
          callStartTime = System.currentTimeMillis()
          android.util.Log.d("CallKeeper", "📞 CHAMADA A TOCAR...")
          
          // Captura o número no Android 12+ através do CallLog
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && incomingNumber == null) {
            incomingNumber = getLastIncomingNumber()
          }
          
          if (incomingNumber != null) {
            android.util.Log.d("CallKeeper", "📱 Número: $incomingNumber")
          } else {
            android.util.Log.w("CallKeeper", "⚠️ Número não capturado!")
          }
        }
        
        TelephonyManager.CALL_STATE_OFFHOOK -> {
          // Chamada foi atendida - cancela o envio de SMS
          android.util.Log.d("CallKeeper", "✅ CHAMADA ATENDIDA - SMS cancelado")
          handler.removeCallbacksAndMessages(null)
          incomingNumber = null
        }
        
        TelephonyManager.CALL_STATE_IDLE -> {
          // Chamada terminou
          if (lastCallState == TelephonyManager.CALL_STATE_RINGING && incomingNumber != null) {
            // Foi uma chamada perdida!
            val missedNumber = incomingNumber
            val callDuration = System.currentTimeMillis() - callStartTime
            
            android.util.Log.d("CallKeeper", "❌ CHAMADA PERDIDA de $missedNumber (duração: ${callDuration}ms)")
            
            // Se tocou por menos de 30 segundos, consideramos perdida
            if (callDuration < 30000) {
              // 🛑 MASTER SWITCH: Check if service is enabled
              val prefs = getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
              val serviceEnabled = prefs.getBoolean("serviceEnabled", true)
              
              if (!serviceEnabled) {
                android.util.Log.d("CallKeeper", "🛑 MASTER SWITCH OFF: Serviço desativado - nenhum SMS será agendado")
                updateNotification("Serviço desativado - nenhuma ação")
              } else {
                android.util.Log.d("CallKeeper", "⏰ A agendar SMS após $delayMinutes minutos...")
                scheduleSMS(missedNumber!!)
              }
            } else {
              android.util.Log.d("CallKeeper", "⏭️ Duração muito longa, ignorando...")
            }
            
            incomingNumber = null
          } else {
            android.util.Log.d("CallKeeper", "📴 Chamada terminada (não era perdida)")
          }
        }
      }
      
      lastCallState = state
    } catch (e: Exception) {
      android.util.Log.e("CallKeeper", "❌ ERRO em handleCallStateChange: ${e.message}", e)
    }
  }

  private fun getLastIncomingNumber(): String? {
    try {
      val cursor = contentResolver.query(
        android.provider.CallLog.Calls.CONTENT_URI,
        arrayOf(android.provider.CallLog.Calls.NUMBER),
        null,
        null,
        android.provider.CallLog.Calls.DATE + " DESC"
      )
      
      cursor?.use {
        if (it.moveToFirst()) {
          return it.getString(0)
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
    return null
  }

  private fun scheduleSMS(phoneNumber: String) {
    val delayMillis = delayMinutes * 60 * 1000L
    
    android.util.Log.d("CallKeeper", "📅 SMS agendado para $phoneNumber em ${delayMinutes} minutos")
    
    handler.postDelayed({
      try {
        val prefs = getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
        
        // 🔧 NORMALIZAR NÚMERO: Remover espaços, hífens, parênteses, etc.
        // Exemplo: "+351 912 345 678" → "+351912345678"
        val normalizedPhone = phoneNumber.replace(Regex("[\\s\\-()]+"), "").trim()
        
        android.util.Log.d("CallKeeper", "🔍 INICIANDO VERIFICAÇÕES")
        android.util.Log.d("CallKeeper", "📞 Número original: '$phoneNumber'")
        android.util.Log.d("CallKeeper", "📞 Número normalizado: '$normalizedPhone'")
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🛑 CHECK #1: MASTER SWITCH (Botão Geral - OFF = Tudo parado)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        val serviceEnabled = prefs.getBoolean("serviceEnabled", true)
        android.util.Log.d("CallKeeper", "🛑 CHECK #1: Master Switch = $serviceEnabled")
        if (!serviceEnabled) {
          android.util.Log.d("CallKeeper", "🛑 MASTER SWITCH OFF: Serviço desativado - ABORTAR TUDO")
          updateNotification("Serviço desativado")
          return@postDelayed
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🌟 CHECK #2: VIP LIST - THE SHORT-CIRCUIT (BYPASS ABSOLUTO!)
        // CRÍTICO: Normalizar TODOS os números da VIP list antes de comparar!
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        val vipListRaw = prefs.getStringSet("vipList", emptySet()) ?: emptySet()
        // Normalizar cada número na VIP list (remover espaços, hífens, etc)
        val vipListNormalized = vipListRaw.map { it.replace(Regex("[\\s\\-()]+"), "").trim() }.toSet()
        
        android.util.Log.d("CallKeeper", "🌟 CHECK #2: VIP LIST (THE SHORT-CIRCUIT)")
        android.util.Log.d("CallKeeper", "🌟 VIP List RAW (${vipListRaw.size}): $vipListRaw")
        android.util.Log.d("CallKeeper", "🌟 VIP List NORMALIZED (${vipListNormalized.size}): $vipListNormalized")
        android.util.Log.d("CallKeeper", "🌟 Verificando se '$normalizedPhone' está na VIP list...")
        
        // Comparar números NORMALIZADOS!
        if (normalizedPhone in vipListNormalized) {
          android.util.Log.d("CallKeeper", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          android.util.Log.d("CallKeeper", "🌟🌟🌟 VIP DETECTADO! 🌟🌟🌟")
          android.util.Log.d("CallKeeper", "🌟 BYPASS ATIVADO - Ignorando:")
          android.util.Log.d("CallKeeper", "    ✓ Bypass Blacklist")
          android.util.Log.d("CallKeeper", "    ✓ Bypass Agenda (Contactos Salvos)")
          android.util.Log.d("CallKeeper", "📤 ENVIANDO SMS VIP IMEDIATAMENTE")
          android.util.Log.d("CallKeeper", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          
          val success = SMSHandler.sendSMS(applicationContext, phoneNumber, autoMessage)
          if (success) {
            android.util.Log.d("CallKeeper", "✅ SMS VIP ENVIADO!")
            updateNotification("✅ SMS VIP enviado")
            
            // 📊 LOG SMS ACTIVITY
            val templateIndex = prefs.getInt("@CallKeeper:activeTemplateIndex", 0)
            logSmsToSharedPrefs(normalizedPhone, templateIndex)
            
            // 🕒 REGISTAR TIMESTAMP (para anti-spam funcionar no próximo envio - mas VIP sempre bypassa!)
            val editor = prefs.edit()
            editor.putLong("last_sent_$normalizedPhone", System.currentTimeMillis())
            editor.apply()
            android.util.Log.d("CallKeeper", "🕒 Timestamp registado (VIP bypassa anti-spam sempre)")
          } else {
            android.util.Log.e("CallKeeper", "❌ FALHA ao enviar SMS VIP!")
            updateNotification("❌ Erro SMS VIP")
          }
          return@postDelayed  // 🛑 STOP! Don't check anything else!
        }
        android.util.Log.d("CallKeeper", "ℹ️ NÃO é VIP. Continuando verificações...")
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🚫 CHECK #3: BLACKLIST (Normalizar também!)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        val blacklistRaw = prefs.getStringSet("blacklist", emptySet()) ?: emptySet()
        val blacklistNormalized = blacklistRaw.map { it.replace(Regex("[\\s\\-()]+"), "").trim() }.toSet()
        
        android.util.Log.d("CallKeeper", "🚫 CHECK #3: Blacklist (${blacklistNormalized.size})")
        if (normalizedPhone in blacklistNormalized) {
          android.util.Log.d("CallKeeper", "🚫 BLOQUEADO na blacklist")
          updateNotification("SMS bloqueado")
          return@postDelayed
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 📇 CHECK #4: AGENDA (Só se NÃO for VIP!)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        val ignoreContacts = prefs.getBoolean("ignoreContacts", false)
        android.util.Log.d("CallKeeper", "📇 CHECK #4: Ignorar contactos = $ignoreContacts")
        if (ignoreContacts) {
          val isInAgenda = isContactSaved(phoneNumber)
          android.util.Log.d("CallKeeper", "📇 Está na agenda? $isInAgenda")
          if (isInAgenda) {
            android.util.Log.d("CallKeeper", "📇 IGNORADO (contacto salvo, NÃO VIP)")
            updateNotification("SMS não enviado (contacto)")
            return@postDelayed
          }
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🕒 CHECK #5: FILTRO ANTI-SPAM (30 MINUTOS)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        val antiSpamEnabled = prefs.getBoolean("@CallKeeper:antiSpamEnabled", false)
        android.util.Log.d("CallKeeper", "🕒 CHECK #5: Anti-Spam Ativo = $antiSpamEnabled")
        
        if (antiSpamEnabled) {
          val lastSentTimestamp = prefs.getLong("last_sent_$normalizedPhone", 0L)
          
          if (lastSentTimestamp > 0L) {
            val timeDiff = System.currentTimeMillis() - lastSentTimestamp
            val thirtyMinutes = 30 * 60 * 1000L // 30 minutos em milissegundos
            
            if (timeDiff < thirtyMinutes) {
              val minutesRemaining = ((thirtyMinutes - timeDiff) / 60000).toInt() + 1
              android.util.Log.d("CallKeeper", "⏱️ BLOQUEADO POR ANTI-SPAM!")
              android.util.Log.d("CallKeeper", "⏱️ Último SMS: ${timeDiff / 1000}s atrás")
              android.util.Log.d("CallKeeper", "⏱️ Aguardar mais: $minutesRemaining minutos")
              updateNotification("⏱️ SMS bloqueado (Anti-Spam)")
              return@postDelayed
            } else {
              android.util.Log.d("CallKeeper", "✅ Anti-Spam OK: Passou mais de 30 min")
            }
          } else {
            android.util.Log.d("CallKeeper", "ℹ️ Anti-Spam: Primeiro SMS para este número")
          }
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ✅ ENVIAR SMS (número desconhecido)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        android.util.Log.d("CallKeeper", "✅ Verificações OK! Enviando SMS...")
        val success = SMSHandler.sendSMS(applicationContext, phoneNumber, autoMessage)
        if (success) {
          android.util.Log.d("CallKeeper", "✅ SMS ENVIADO!")
          updateNotification("✅ SMS enviado")
          
          // 📊 LOG SMS ACTIVITY
          val templateIndex = prefs.getInt("@CallKeeper:activeTemplateIndex", 0)
          logSmsToSharedPrefs(normalizedPhone, templateIndex)
          
          // 🕒 REGISTAR TIMESTAMP (para anti-spam funcionar no próximo envio)
          val editor = prefs.edit()
          editor.putLong("last_sent_$normalizedPhone", System.currentTimeMillis())
          editor.apply()
          android.util.Log.d("CallKeeper", "🕒 Timestamp registado para anti-spam")
        } else {
          android.util.Log.e("CallKeeper", "❌ FALHA ao enviar SMS!")
          updateNotification("❌ Erro ao enviar")
        }
      } catch (e: Exception) {
        android.util.Log.e("CallKeeper", "❌ ERRO ao processar SMS: ${e.message}", e)
      }
    }, delayMillis)
  }
  
  private fun isContactSaved(phoneNumber: String): Boolean {
    try {
      val uri = Uri.withAppendedPath(
        ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
        Uri.encode(phoneNumber)
      )
      
      val cursor: Cursor? = contentResolver.query(
        uri,
        arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
        null,
        null,
        null
      )
      
      cursor?.use {
        if (it.moveToFirst()) {
          val name = it.getString(0)
          android.util.Log.d("CallKeeper", "📇 Contacto encontrado: $name")
          return true
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("CallKeeper", "❌ ERRO ao verificar contacto: ${e.message}", e)
    }
    
    return false
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "ClientS Service",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Mantém o ClientS ativo em segundo plano"
      }
      
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this, 0, intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("ClientS Ativo")
      .setContentText("A monitorizar chamadas perdidas...")
      .setSmallIcon(android.R.drawable.ic_menu_call)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(text: String) {
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("ClientS")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_menu_call)
      .setOngoing(true)
      .build()
    
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, notification)
  }

  override fun onDestroy() {
    android.util.Log.d("CallKeeper", "⏹️ SERVIÇO PARADO (onDestroy)")
    
    // Cancel all pending SMS
    handler.removeCallbacksAndMessages(null)
    android.util.Log.d("CallKeeper", "🗑️ Todos os SMS agendados foram cancelados")
    
    super.onDestroy()
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      telephonyCallback?.let { 
        telephonyManager.unregisterTelephonyCallback(it) 
        android.util.Log.d("CallKeeper", "📵 TelephonyCallback unregistered")
      }
    } else {
      phoneStateListener?.let { 
        @Suppress("DEPRECATION")
        telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
        android.util.Log.d("CallKeeper", "📵 PhoneStateListener unregistered")
      }
    }
    
    isServiceRunning = false
    android.util.Log.d("CallKeeper", "✅ Serviço completamente desligado")
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
