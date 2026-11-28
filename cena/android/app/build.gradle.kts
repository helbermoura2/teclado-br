plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val cenaAbi = providers.gradleProperty("cenaAbi").orElse("arm64-v8a").get()
require(cenaAbi in setOf("arm64-v8a", "x86_64")) { "Unsupported CENA ABI" }
val cenaEdition = providers.gradleProperty("cenaEdition").orElse("standard").get()
require(cenaEdition in setOf("standard", "next")) { "Unsupported CENA edition" }
android {
    namespace = "app.cena"
    ndkVersion = "28.0.13004108"
    compileSdk = 35
    defaultConfig {
        applicationId = if (cenaEdition == "next") "app.cena.mobile.next" else "app.cena.mobile"
        manifestPlaceholders["cenaAppLabel"] = "CENA IA"
        ndk { abiFilters += cenaAbi }
        minSdk = 26
        targetSdk = 35
        versionCode = 95
        versionName = "0.28.28"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    System.getenv("CENA_KEYSTORE_PATH")?.let { path ->
        signingConfigs.getByName("debug") {
            storeFile = file(path)
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    sourceSets["main"].assets.srcDir("../../web")
    sourceSets["androidTest"].assets.srcDir("../../tests/fixtures")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.work:work-runtime-ktx:2.10.2")
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.22.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test.espresso:espresso-intents:3.6.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-ktx:1.16.0")
    // Bundled Latin text model: OCR runs on the device, without a remote service.
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.google.mlkit:language-id:17.0.6")
    implementation("com.google.mlkit:translate:17.0.3")
}

