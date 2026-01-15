allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    pluginManager.withPlugin("com.android.library") {
        val android = extensions.findByName("android")
        if (android != null) {
            try {
                // Set a default namespace immediately when plugin applies.
                // If the library's build.gradle sets one later, it will override this (which is desired).
                // If it doesn't set one (the error case), this default sticks.
                val setNamespace = android.javaClass.getMethod("setNamespace", String::class.java)
                val safeName = project.name.replace(Regex("[^a-zA-Z0-9_]"), "_")
                setNamespace.invoke(android, "com.example.$safeName")
            } catch (e: Exception) {
                // Ignore reflection errors
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
