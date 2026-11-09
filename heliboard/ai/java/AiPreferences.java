// SPDX-License-Identifier: GPL-3.0-only
package helium314.keyboard.latin.ai;
import android.content.Context;
import android.net.*;
import android.os.UserManager;
public final class AiPreferences {
    public static final String OFFLINE="offline",AUTO="auto",ONLINE="online";
    public static String mode(Context c) {
        String m=c.getSharedPreferences("writing-options",0).getString("mode",OFFLINE);
        return AUTO.equals(m)||ONLINE.equals(m)?m:OFFLINE;
    }
    public static void mode(Context c,String mode) {
        if(!OFFLINE.equals(mode)&&!AUTO.equals(mode)&&!ONLINE.equals(mode))throw new IllegalArgumentException();
        c.getSharedPreferences("writing-options",0).edit().putString("mode",mode).commit();
    }
    public static String label(Context c) {
        switch(mode(c)) {
            case AUTO:return "Automático · Gemini → Groq → aparelho";
            case ONLINE:return "Online · Gemini / Groq";
            default:return "Offline · aparelho";
        }
    }
    public static boolean connected(Context c) {
        UserManager u=(UserManager)c.getSystemService(Context.USER_SERVICE);
        if(u!=null&&!u.isUserUnlocked())return false;
        ConnectivityManager m=(ConnectivityManager)c.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities n=m==null?null:m.getNetworkCapabilities(m.getActiveNetwork());
        return n!=null&&n.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&n.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
    public static boolean canStart(Context c) {
        String mode=mode(c);
        boolean onlineKey=SecretStore.hasGeminiKey(c)||SecretStore.hasKey(c);
        if(ONLINE.equals(mode))return onlineKey;
        return AUTO.equals(mode)&&onlineKey||ModelStore.model(c).isFile();
    }
}
