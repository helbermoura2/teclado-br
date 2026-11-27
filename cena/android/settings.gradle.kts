pluginManagement { repositories { google(); maven { url = uri(System.getenv("CENA_MAVEN_CENTRAL_URL") ?: "https://repo.maven.apache.org/maven2") }; gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); maven { url = uri(System.getenv("CENA_MAVEN_CENTRAL_URL") ?: "https://repo.maven.apache.org/maven2") } } }
rootProject.name = "Cena"
include(":app")
