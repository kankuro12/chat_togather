package com.together.couple;
import com.getcapacitor.BridgeActivity;import android.os.Bundle;import android.content.Intent;
public class MainActivity extends BridgeActivity{
@Override public void onCreate(Bundle state){registerPlugin(NativeCallsPlugin.class);saveCall(getIntent());super.onCreate(state);}
@Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);saveCall(intent);if(bridge!=null)bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('native-call-action'))",null);}
private void saveCall(Intent intent){String id=intent.getStringExtra("call_id");if(id!=null)getSharedPreferences("calls",MODE_PRIVATE).edit().putString("id",id).putString("action",intent.getStringExtra("call_action")).apply();}
}
