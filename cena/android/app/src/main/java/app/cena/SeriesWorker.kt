package app.cena

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class SeriesWorker(context:Context,parameters:WorkerParameters):Worker(context,parameters){
    override fun doWork():Result=try{if(SeriesRepository(applicationContext).refresh())schedule(applicationContext,true);Result.success()}catch(_:Exception){Result.retry()}
    companion object {
        fun schedule(context:Context,continuation:Boolean=false){
            val request=OneTimeWorkRequestBuilder<SeriesWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("cena-series-refresh",if(continuation)ExistingWorkPolicy.APPEND_OR_REPLACE else ExistingWorkPolicy.KEEP,request)
        }
        fun cancel(context:Context){WorkManager.getInstance(context).cancelUniqueWork("cena-series-refresh")}
    }
}
