package arcs.web.impl;

import arcs.api.ArcsEnvironment;
import arcs.api.DeviceClientImpl;
import arcs.api.PECInnerPortFactory;
import arcs.api.PecPortManager;
import arcs.api.PortableJsonParser;
import arcs.api.UiBroker;
import javax.inject.Inject;
import jsinterop.annotations.JsType;

@JsType(namespace = "arcs")
public class DeviceClientJsImpl extends DeviceClientImpl {
  @Inject
  public DeviceClientJsImpl(
      PortableJsonParser jsonParser,
      ArcsEnvironment environment,
      PecPortManager pecPortManager,
      UiBroker uiBroker) {
    super(jsonParser, environment, pecPortManager, uiBroker);
  }

  @Override
  public void receive(String json) {
    super.receive(json);
  }
}
