package app.cena

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class WatchHistoryWorker(context:Context,parameters:WorkerParameters):Worker(context,parameters){
 override fun doWork():Result {
  // Work persisted by older versions (periodic or automatic) must never import.
  if(!inputData.getBoolean("manual",false))return Result.success()
  return try{WatchHistoryRepository(applicationContext).use{repo->when(repo.importBatch(inputData.getBoolean("force",false),manual=true)){
   HistoryPass.COMPLETE->Result.success()
   HistoryPass.FAILED->Result.failure()
   HistoryPass.MORE->{WorkManager.getInstance(applicationContext).enqueueUniqueWork(NAME,ExistingWorkPolicy.APPEND_OR_REPLACE,request(false));Result.success()}
  }}}catch(_:Exception){Result.failure()}
 }
 companion object {
  private const val NAME="cena-history-manual-v2"
  private fun request(force:Boolean)=OneTimeWorkRequestBuilder<WatchHistoryWorker>().setInputData(workDataOf("force" to force,"manual" to true)).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
  fun cancelLegacy(context:Context){val manager=WorkManager.getInstance(context);for(name in listOf("cena-history-periodic","cena-history-import","cena-history-pages"))manager.cancelUniqueWork(name)}
  fun schedule(context:Context,force:Boolean=false){if(!force)return;cancelLegacy(context);WorkManager.getInstance(context).enqueueUniqueWork(NAME,ExistingWorkPolicy.KEEP,request(true))}
 }
}
