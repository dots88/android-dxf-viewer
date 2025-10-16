plugins {
	id("com.android.application")
	id("org.jetbrains.kotlin.android")
}

android {
	namespace = "com.dots.dxfviewer"
	compileSdk = 34

	defaultConfig {
		applicationId = "com.dots.dxfviewer"
		minSdk = 26
		targetSdk = 34
		versionCode = 1
		versionName = "0.1.0"
	}

	buildTypes {
		release {
			isMinifyEnabled = false
			proguardFiles(
				getDefaultProguardFile("proguard-android-optimize.txt"),
				"proguard-rules.pro"
			)
		}
	}

	buildFeatures {
		compose = true
	}

	composeOptions {
		kotlinCompilerExtensionVersion = "1.5.14"
	}

	compileOptions {
		sourceCompatibility = JavaVersion.VERSION_17
		targetCompatibility = JavaVersion.VERSION_17
	}

	kotlinOptions {
		jvmTarget = "17"
	}
}

dependencies {
	implementation(platform("androidx.compose:compose-bom:2024.10.01"))
	implementation("androidx.activity:activity-compose:1.9.3")
	implementation("androidx.compose.ui:ui")
	implementation("androidx.compose.ui:ui-tooling-preview")
	implementation("androidx.compose.material3:material3:1.3.0")
	implementation("androidx.webkit:webkit:1.11.0")
	implementation("androidx.core:core-ktx:1.13.1")
	debugImplementation("androidx.compose.ui:ui-tooling")
}
