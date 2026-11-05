plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

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
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
