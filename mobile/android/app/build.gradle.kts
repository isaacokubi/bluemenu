plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val signingReady = listOf("ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD").all { !System.getenv(it).isNullOrBlank() }

android {
    namespace = "com.bluemenu.discovery"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bluemenu.discovery"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        val apiBaseUrl = (project.findProperty("BLUEMENU_API_BASE_URL") as String?) ?: "https://your-api-domain.example"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }
    signingConfigs {
        create("release") {
            if (signingReady) {
                storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH")!!)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            if (signingReady) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
