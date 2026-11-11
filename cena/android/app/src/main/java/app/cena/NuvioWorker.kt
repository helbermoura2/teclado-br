package app.cena

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class NuvioWorker(context:Context,parameters:WorkerParameters):Worker(context,parameters){
 override fun doWork():Result=try{val repo=NuvioRepository(applicationContext);if(!repo.enabled()||repo.sync())Result.success()else Result.retry()}catch(_:Exception){Result.retry()}
 companion object {
  fun schedule(context:Context){val request=PeriodicWorkRequestBuilder<NuvioWorker>(12,TimeUnit.HOURS).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.MINUTES).build();WorkManager.getInstance(context).enqueueUniquePeriodicWork("cena.nuvio.sync.v1",ExistingPeriodicWorkPolicy.KEEP,request)}
  fun cancel(context:Context){WorkManager.getInstance(context).cancelUniqueWork("cena.nuvio.sync.v1")}
 }
}
