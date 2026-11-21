package app.cena

/** Only loaded in the private :localai process; weights are not bundled. */
object LocalAiNative {
    init {System.loadLibrary("cenallm")}
    @JvmStatic external fun epoch():Long
    @JvmStatic external fun cancel()
    @JvmStatic external fun generate(descriptor:Int,prompt:ByteArray,epoch:Long,maximum:Int):ByteArray
}
