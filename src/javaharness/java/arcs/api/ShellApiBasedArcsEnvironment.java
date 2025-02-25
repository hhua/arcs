package arcs.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import javax.inject.Inject;
import javax.inject.Singleton;

/**
 * Web based ArcsEnvironment using ShellApi. The Android version of this will different only in not
 * needing to use the ShellApi + Web runtime.
 */
@Singleton
public class ShellApiBasedArcsEnvironment implements ArcsEnvironment {

  private static final Logger logger = Logger.getLogger(ShellApiBasedArcsEnvironment.class.getName());

  private final Map<String, DataListener> inProgress = new HashMap<>();
  private final List<ReadyListener> readyListeners = new ArrayList<>();
  private ShellApi shellApi;

  @Inject
  public ShellApiBasedArcsEnvironment(ShellApi shellApi) {
    this.shellApi = shellApi;
  }

  @Override
  public void sendMessageToArcs(String msg, DataListener listener) {
    String transactionId = String.valueOf(shellApi.receive(msg));
    if (listener != null) {
      logger.warning("Deprecated use of `listener` in msg: " + msg);
      inProgress.put(transactionId, listener);
    }
  }

  @Override
  public void fireDataEvent(String tid, String data) {
    if (inProgress.containsKey(tid)) {
      if (data != null) {
        inProgress.get(tid).onData(tid, data);
      }
      inProgress.remove(tid);
    }
  }

  @Override
  public void addReadyListener(ReadyListener listener) {
    readyListeners.add(listener);
  }

  @Override
  public void fireReadyEvent(List<String> recipes) {
    readyListeners.forEach(listener -> listener.onReady(recipes));
  }

  @Override
  public void init() {}

  @Override
  public void reset() {}

  @Override
  public void destroy() {}

  @Override
  public void show() {}

  @Override
  public void hide() {}
}
