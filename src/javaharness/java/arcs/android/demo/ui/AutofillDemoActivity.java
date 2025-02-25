package arcs.android.demo.ui;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.autofill.AutofillManager;
import android.widget.Button;
import android.widget.TextView;

/** Autofill demo activity. Contains Autofill status info, and some example autofill fields. */
public class AutofillDemoActivity extends Activity {

  private static final int REQUEST_CODE_AUTOFILL_SET = 1;
  private AutofillManager autofillManager;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    autofillManager = getSystemService(AutofillManager.class);

    setContentView(R.layout.autofill_demo);
    updateSettingStatus();
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == REQUEST_CODE_AUTOFILL_SET) {
      updateSettingStatus();
    } else {
      throw new UnsupportedOperationException("Unknown request code: " + requestCode);
    }
  }

  /** Updates the status UI to indicate whether the Arcs Autofill service is enabled or not. */
  private void updateSettingStatus() {
    boolean supported = autofillManager.isAutofillSupported();
    boolean enabled = supported && autofillManager.hasEnabledAutofillServices();

    TextView status = findViewById(R.id.autofill_settings_status);
    Button settingsButton = findViewById(R.id.autofill_settings_button);

    if (enabled) {
      status.setText("Autofill Service enabled");
      settingsButton.setVisibility(View.GONE);
    } else if (supported) {
      status.setText("Autofill Service not enabled");
      settingsButton.setVisibility(View.VISIBLE);
      settingsButton.setOnClickListener(v -> openAutofillSettings());
    } else {
      status.setText("Autofill not supported on this device");
      settingsButton.setVisibility(View.GONE);
    }
  }

  private void openAutofillSettings() {
    Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
    intent.setData(Uri.parse("package:arcs.android.demo"));
    startActivityForResult(intent, REQUEST_CODE_AUTOFILL_SET);
  }

  /** Called when an autofill field gets tapped. Requests that the field gets filled. */
  private void onFieldTap(View view) {
    autofillManager.requestAutofill(view);
  }
}
