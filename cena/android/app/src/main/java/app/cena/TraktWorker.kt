package app.cena

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class TraktWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
    override fun doWork(): Result {
        val repo=TraktRepository(applicationContext)
        return try { repo.sync(); if(repo.status().optString("error").isNotBlank() && repo.status().optBoolean("connected") && !repo.status().optBoolean("blocked")) Result.retry() else Result.success() } catch(_:Exception) { Result.retry() }
    }
    companion object {
        fun schedule(context: Context) {
            val constraints=Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            val manager=WorkManager.getInstance(context)
            manager.enqueueUniquePeriodicWork("cena-trakt-periodic",ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<TraktWorker>(15,TimeUnit.MINUTES).setConstraints(constraints).build())
            manager.enqueueUniqueWork("cena-trakt-outbox",ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<TraktWorker>().setConstraints(constraints).setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build())
        }
        fun cancel(context: Context) { val manager=WorkManager.getInstance(context); manager.cancelUniqueWork("cena-trakt-periodic"); manager.cancelUniqueWork("cena-trakt-outbox") }
    }
}
