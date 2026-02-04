package com.LectureLet.app

import android.app.Application
import android.content.res.Configuration
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)

    // Create notification channels for custom sounds
    // Android notification channels are immutable once created.
    // If you change the sound or other settings, you must change the channel ID,
    // otherwise Android will ignore the new settings and use the old ones.
    // That is why we use distinct channels for each sound and must never edit them in place.
    // NOTE: You must uninstall and reinstall the app for these changes to take effect properly if the app was already installed.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(NotificationManager::class.java)
      val packageName = packageName

      // Define channels
      val channels = listOf(
        Triple("lecturelet_r1_channel", "LectureLet Alert 1", R.raw.r1),
        Triple("lecturelet_r2_channel", "LectureLet Alert 2", R.raw.r2),
        Triple("lecturelet_r3_channel", "LectureLet Alert 3", R.raw.r3)
      )

      for ((channelId, channelName, soundResId) in channels) {
        val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH)
        channel.description = "Channel for $channelName"
        
        val audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
          
        val soundUri = Uri.parse("android.resource://$packageName/$soundResId")
        channel.setSound(soundUri, audioAttributes)
        channel.enableVibration(true)
        
        notificationManager.createNotificationChannel(channel)
      }
      
      // Log success
      android.util.Log.d("LectureLet", "Notification channels created via Native Code")
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
