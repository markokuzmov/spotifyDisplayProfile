const clientId = import.meta.env.VITE_CLIENT_ID
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const redirect_uri = `${window.location.origin}/callback`

const generateCodeVerifier = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const generateCodeChallenge = async (verifier) => {
    const data = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

const redirectToAuthCodeFlow = async () => {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirect_uri,
        scope: "user-read-private user-read-email user-top-read",
        code_challenge_method: "S256",
        code_challenge: challenge
    });

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`
}

const getAccessToken = async (code) => {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        code_verifier: verifier
    });

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    })

    const data = await result.json()
    const { access_token, refresh_token } = data;

    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)

    return access_token
}

const getRefreshToken = async () => {
    const refresh_token = localStorage.getItem('refresh_token')
    
    const result = fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refresh_token,
            client_id: clientId
        }),
    })

    const data = await result.json()
    const { access_token, refreshToken } = data;

    localStorage.setItem('access_token', access_token)
    if (refresh_token) {
        localStorage.setItem('refresh_token', refreshToken)
    }
}

const fetchWithAuth = async (URL, options = {}) => {
    let token = localStorage.getItem('access_token');

    let result = await fetch(URL, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        }
    });

    if (result.status === 401) {
        getRefreshToken()
        token = localStorage.getItem('access_token')

        let result = await fetch(URL, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`
            }
        });
    }

    return result
}

const fetchProfile = async () => {
    const result = await fetchWithAuth("https://api.spotify.com/v1/me") 
    return result.json()
}

const fetchTopArtists = async () => {
    const result = await fetchWithAuth("https://api.spotify.com/v1/me/top/artists?time_range=short_term")
    return result.json()
}

const fetchTopTracks = async () => {
    const result = await fetchWithAuth("https://api.spotify.com/v1/me/top/tracks?time_range=short_term")
    return result.json()
}

function populateProfileUI(profile) {

    document.getElementById("displayName").innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar").appendChild(profileImage);
        document.getElementById("imgUrl").innerText = profile.images[0].url;
    }
    document.getElementById("id").innerText = profile.id;
    document.getElementById("email").innerText = profile.email;
    document.getElementById("url").innerText = profile.uri;
    document.getElementById("url").setAttribute("href", profile.external_urls.spotify);
    document.getElementById("uri").innerText = profile.href;
    document.getElementById("uri").setAttribute("href", profile.href);

}

function populateTopItemsUI(topArtists, topTracks) {
    var artistList = document.getElementById("topArtists")
    var trackList = document.getElementById("topTracks")

    for (var artist of topArtists.items) {
        var li = document.createElement('li')
        var artistImage = new Image(50, 50)
        artistImage.src = artist.images[0].url
        li.appendChild(artistImage)
        li.appendChild(document.createTextNode(artist.name))
        artistList.appendChild(li)
    }

    for (var track of topTracks.items) {
        var li = document.createElement('li')

        var trackImage = new Image(50, 50)
        trackImage.src = track.album.images[0].url
        li.appendChild(trackImage)
        li.appendChild(document.createTextNode(track.name))

        var link = document.createElement('a')
        link.setAttribute("href", track.external_urls.spotify)
        link.setAttribute("target", "_blank")
        link.appendChild(li)
        
        trackList.appendChild(link)
    }

}

if (!code) {
    redirectToAuthCodeFlow();
} else {
    await getAccessToken(code)

    window.history.replaceState({}, document.title, redirect_uri);

    const profile = await fetchProfile()
    const topArtists = await fetchTopArtists()
    const topTracks = await fetchTopTracks()

    console.log(profile, topArtists, topTracks)

    populateProfileUI(profile)
    populateTopItemsUI(topArtists, topTracks)
}