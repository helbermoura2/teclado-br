package app.cena

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class WatchHistoryWorker(context:Context,parameters:WorkerParameters):Worker(context,parameters){
 override fun doWork():Result=try{WatchHistoryRepository(applicationContext).use{repo->when(repo.importBatch(inputData.getBoolean("force",false))){
  HistoryPass.COMPLETE->Result.success()
  HistoryPass.FAILED->Result.retry()
  HistoryPass.MORE->{WorkManager.getInstance(applicationContext).enqueueUniqueWork("cena-history-pages",ExistingWorkPolicy.APPEND_OR_REPLACE,request());Result.success()}
 }}}catch(_:Exception){Result.retry()}
 companion object {
  private fun request(force:Boolean=false)=OneTimeWorkRequestBuilder<WatchHistoryWorker>().setInputData(workDataOf("force" to force)).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build()
  fun schedule(context:Context,force:Boolean=false){val manager=WorkManager.getInstance(context);manager.enqueueUniquePeriodicWork("cena-history-periodic",ExistingPeriodicWorkPolicy.KEEP,PeriodicWorkRequestBuilder<WatchHistoryWorker>(12,TimeUnit.HOURS).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());manager.enqueueUniqueWork("cena-history-import",ExistingWorkPolicy.KEEP,request(force))}
 }
}
