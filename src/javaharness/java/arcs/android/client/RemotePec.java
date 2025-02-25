package arcs.android.client;

import android.os.RemoteException;
import arcs.android.api.IRemotePecCallback;
import arcs.api.Id;
import arcs.api.IdGenerator;
import arcs.api.PECInnerPort;
import arcs.api.PECInnerPortFactory;
import arcs.api.Particle;
import arcs.api.PortableJson;
import arcs.api.PortableJsonParser;
import javax.inject.Inject;

public class RemotePec {

  private final ArcsServiceBridge bridge;
  private final PECInnerPortFactory pecInnerPortFactory;
  private final PortableJsonParser jsonParser;

  private PECInnerPort pecInnerPort;
  private Id arcId;

  private final IRemotePecCallback callback =
      new IRemotePecCallback.Stub() {
        @Override
        public void onMessage(String message) {
          PortableJson json = jsonParser.parse(message);
          pecInnerPort.onReceivePecMessage(json);
        }
      };

  @Inject
  RemotePec(
      ArcsServiceBridge bridge,
      PECInnerPortFactory pecInnerPortFactory,
      PortableJsonParser jsonParser) {
    this.bridge = bridge;
    this.pecInnerPortFactory = pecInnerPortFactory;
    this.jsonParser = jsonParser;
  }

  public Id getArcId() {
    return arcId;
  }
  /**
   * Starts a new arc running the given recipe. The given particle implementation is attached to
   * that arc.
   */
  // TODO(mmandlis): This method should accept additional options: arcId and pecId.
  public void runArc(String recipe, Particle particle) {
    if (pecInnerPort != null) {
      throw new IllegalStateException("PEC has already been initialized.");
    }

    IdGenerator idGenerator = IdGenerator.newSession();
    arcId = Id.newArcId();
    Id pecId = idGenerator.newChildId(arcId, "pec");
    Id particleId = idGenerator.newChildId(pecId, "particle");

    particle.setId(particleId.toString());
    particle.setJsonParser(jsonParser);

    pecInnerPort =
        pecInnerPortFactory.createPECInnerPort(pecId.toString(), idGenerator.getSessionId());
    pecInnerPort.mapParticle(particle);

    bridge.startArc(
        arcId.toString(), pecId.toString(), recipe, particle.getId(), particle.getName(), callback);
  }

  /** Shuts down the running arc and remote PEC. */
  public void shutdown() {
    if (pecInnerPort == null) {
      return;
    }
    String pecId = this.pecInnerPort.getId();
    pecInnerPort = null;

    String arcId = this.arcId.toString();
    this.arcId = null;

    bridge.stopArc(arcId, pecId);
  }
}
