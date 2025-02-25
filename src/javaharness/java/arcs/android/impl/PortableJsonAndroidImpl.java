package arcs.android.impl;

import android.util.Log;
import arcs.api.PortableJson;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

class PortableJsonAndroidImpl implements PortableJson {

  private Object jsonObject;

  PortableJsonAndroidImpl(JSONObject jsonObject) {
    this.jsonObject = jsonObject;
  }

  PortableJsonAndroidImpl(JSONArray jsonObject) {
    this.jsonObject = jsonObject;
  }

  String stringify() {
    return jsonObject.toString();
  }

  interface JsonObjectFunction<T> {
    T apply(JSONObject obj) throws JSONException;
  }

  interface JsonArrayFunction<T> {
    T apply(JSONArray arr) throws JSONException;
  }

  private <T> T object(JsonObjectFunction<T> func) {
    try {
      return func.apply((JSONObject) jsonObject);
    } catch (JSONException e) {
      Log.e("Arcs", "Exception, Json is " + ((JSONObject) jsonObject).toString(), e);
    }
    return null;
  }

  private <T> T array(JsonArrayFunction<T> func) {
    try {
      return func.apply((JSONArray) jsonObject);
    } catch (JSONException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public String getString(int index) {
    return array(x -> x.getString(index));
  }

  @Override
  public String getString(String key) {
    return object(x -> x.getString(key));
  }

  @Override
  public int getInt(int index) {
    return array(x -> x.getInt(index));
  }

  @Override
  public int getInt(String key) {
    return object(x -> x.getInt(key));
  }

  @Override
  public double getNumber(int index) {
    return array(x -> x.getDouble(index));
  }

  @Override
  public double getNumber(String key) {
    return object(x -> x.getDouble(key));
  }

  @Override
  public boolean getBool(int index) {
    return array(x -> x.getBoolean(index));
  }

  @Override
  public boolean getBool(String key) {
    return object(x -> x.getBoolean(key));
  }

  @Override
  public PortableJson getObject(int index) {
    return array(x -> new PortableJsonAndroidImpl(x.getJSONObject(index)));
  }

  @Override
  public PortableJson getObject(String key) {
    return object(x -> new PortableJsonAndroidImpl(x.getJSONObject(key)));
  }

  @Override
  public int getLength() {
    return array(JSONArray::length);
  }

  @Override
  public boolean hasKey(String key) {
    return object(x -> x.has(key));
  }

  @Override
  public void forEach(Consumer<String> callback) {
    keys().forEach(callback::accept);
  }

  @Override
  public List<String> keys() {
    return object(
        x -> {
          List<String> keyList = new ArrayList<>();
          x.keys().forEachRemaining(y -> keyList.add(y));
          return keyList;
        });
  }

  @Override
  public List<String> asStringArray() {
    List<String> result = new ArrayList<>();
    for (int i = 0; i < getLength(); i++) {
      result.add(getString(i));
    }
    return result;
  }

  @Override
  public List<PortableJson> asObjectArray() {
    List<PortableJson> result = new ArrayList<>();
    for (int i = 0; i < getLength(); i++) {
      result.add(getObject(i));
    }
    return result;
  }

  @Override
  public PortableJson put(String key, int num) {
    object(x -> x.put(key, num));
    return this;
  }

  @Override
  public PortableJson put(String key, double num) {
    object(x -> x.put(key, num));
    return this;
  }

  @Override
  public PortableJson put(String key, String value) {
    object(x -> x.put(key, value));
    return this;
  }

  @Override
  public PortableJson put(String key, boolean bool) {
    object(x -> x.put(key, bool));
    return this;
  }

  @Override
  public PortableJson put(String key, PortableJson obj) {
    object(x -> x.put(key, ((PortableJsonAndroidImpl) obj).getRawObj()));
    return this;
  }

  @Override
  public PortableJson put(int index, int num) {
    array(x -> x.put(index, num));
    return this;
  }

  @Override
  public PortableJson put(int index, double num) {
    array(x -> x.put(index, num));
    return this;
  }

  @Override
  public PortableJson put(int index, String value) {
    array(x -> x.put(index, value));
    return this;
  }

  @Override
  public PortableJson put(int index, boolean bool) {
    array(x -> x.put(index, bool));
    return this;
  }

  @Override
  public PortableJson put(int index, PortableJson obj) {
    array(x -> x.put(index, ((PortableJsonAndroidImpl) obj).getRawObj()));
    return this;
  }

  @Override
  public int hashCode() {
    return getRawObj().hashCode();
  }

  @Override
  public boolean equals(Object other) {
    if (!(other instanceof PortableJsonAndroidImpl)) {
      return false;
    }
    return stringify().equals(((PortableJsonAndroidImpl) other).stringify());
  }

  @Override
  public PortableJson getArray(String key) {
    return object(x -> new PortableJsonAndroidImpl(x.getJSONArray(key)));
  }

  @Override
  public PortableJson getArray(int index) {
    return array(x -> new PortableJsonAndroidImpl(x.getJSONArray(index)));
  }

  Object getRawObj() {
    return jsonObject;
  }
}
