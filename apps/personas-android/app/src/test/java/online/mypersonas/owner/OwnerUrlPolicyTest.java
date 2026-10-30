package online.mypersonas.owner;

import org.junit.Test;
import static org.junit.Assert.*;

public class OwnerUrlPolicyTest {
    @Test public void acceptsOnlyExactOwnerOrDebugLoopbackOrigins() {
        assertTrue(OwnerUrlPolicy.allowed("https://mypersonas.online/#/owner", false));
        assertTrue(OwnerUrlPolicy.allowed("http://localhost:3000/#/owner", true));
        assertTrue(OwnerUrlPolicy.allowed("http://10.0.2.2:3000/", true));
        assertFalse(OwnerUrlPolicy.allowed("http://localhost:3000/", false));
        for (String url : new String[]{"http://localhost:123@attacker.test/", "http://127.0.0.1:80@attacker.test/", "https://mypersonas.online.evil.test/", "https://owner@mypersonas.online/", "https://mypersonas.online:444/", "file:///etc/passwd", "http://localhost:99999/", "https://mypersonas.online\\@evil.test/"}) {
            assertFalse(url, OwnerUrlPolicy.allowed(url, true));
        }
    }
}
