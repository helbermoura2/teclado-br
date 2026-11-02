package app.cena;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Standalone test-APK process: use only platform classes, no target-app dependencies. */
public final class TestModelProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    private File fixture(Uri uri) {
        if (!"/model".equals(uri.getPath())) throw new IllegalArgumentException();
        return new File(getContext().getFilesDir(), "smoke.gguf");
    }
    @Override public Bundle call(String method, String arg, Bundle extras) {
        if (!"grant".equals(method)) throw new UnsupportedOperationException();
        getContext().grantUriPermission("app.cena.mobile", Uri.parse("content://app.cena.mobile.test.model/model"), Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return new Bundle();
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new IllegalArgumentException();
        return ParcelFileDescriptor.open(fixture(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public String getType(Uri uri) { return "application/octet-stream"; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        File file = fixture(uri);
        MatrixCursor cursor = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        cursor.addRow(new Object[]{file.getName(), file.length()});
        return cursor;
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String where, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String where, String[] args) { throw new UnsupportedOperationException(); }
}
