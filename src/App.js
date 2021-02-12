import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";

const Container = styled.div`
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  width: 100%;
`;

const Video = styled.video`
  border: 1px solid blue;
  width: 50%;
  height: 50%;
`;

function App() {
  const [yourID, setYourID] = useState(""); //Id of the user
  const [users, setUsers] = useState({}); //Object what will store all users in the room
  const [stream, setStream] = useState(); //Steaming object (Video for example)
  const [receivingCall, setReceivingCall] = useState(false); //Boolean that allows us to know if the user recieved a call
  const [caller, setCaller] = useState(""); //User that call you
  const [callerSignal, setCallerSignal] = useState(); //Signal of the caller
  const [callAccepted, setCallAccepted] = useState(false); //Boolean that shows if the user accepted the call

  const userVideo = useRef(); //Reference for the video
  const partnerVideo = useRef(); //Reference for the video od the other user
  const socket = useRef(); //Reference for the socket (It needs to be constant across re-renders => useRef hook)

  useEffect(() => {
    socket.current = io.connect("https://git.heroku.com/prueba-hack.git", {
      withCredentials: true,
      extraHeaders: {
        "my-custom-header": "abcd",
      },
    }); //We connect to the io api => (Connecting with the main route in the server (""))
    navigator.mediaDevices //Acces to the navigator media
      .getUserMedia({ video: true, audio: true }) //We obtain the video and audio
      .then((stream) => {
        //After the user has accepted the credentials..
        setStream(stream); //We update the stream state
        if (userVideo.current) {
          //If our user (us) has video...
          userVideo.current.srcObject = stream; //We stablished that the src is going to be the stream
        }
      });

    socket.current.on("yourID", (id) => {
      //We suscribe to the event "yourID"
      setYourID(id); //If the event is called (from server) we're going to update the state of the id of the user
    });
    socket.current.on("allUsers", (users) => {
      //We suscribe to the event "allUsers"
      console.log("Tenemos los valores de los usuarios");
      setUsers(users); //We update the users
    });

    socket.current.on("hey", (data) => {
      //We suscribe to the event "hey"
      console.log("Estamos actualizando 'Receiving Call'");
      setReceivingCall(true); //We set that we have a receiving call
      setCaller(data.from); //We set who is the caller
      setCallerSignal(data.signal); //We set the caller signal
    });
  }, []);

  function callPeer(id) {
    //Function that runs when the user wants to connect to a another user
    const peer = new Peer({
      //We create a peer (us)
      initiator: true, //We are the initiator
      trickle: false,
      stream: stream,
    });

    console.log("Hemos llamado y creado al peer", peer);

    peer.on("signal", (data) => {
      //When we recieve a "signal"
      console.log("Lanzando una señal desde el peer");
      socket.current.emit("callUser", {
        //We emmit an event (callUser) passing the id, the data and our id
        userToCall: id,
        signalData: data,
        from: yourID,
      });
    });

    peer.on("stream", (stream) => {
      //When we recieve a "stream"
      console.log("Hemos creado el stream");
      if (partnerVideo.current) {
        //If the user has video

        partnerVideo.current.srcObject = stream; //We relate the current video with the stream that was passed to us
      }
    });

    console.log("Recibió la llamada?: ", receivingCall);

    socket.current.on("callAccepted", (signal) => {
      //We suscribe to the event "callAccepted"

      console.log("La señal fue aceptada");
      setCallAccepted(true); //We set that the call is accepted
      peer.signal(signal); //We send a signal
    });
  }

  //Function that runs when the user accept the call
  function acceptCall() {
    //We update our state
    setCallAccepted(true);
    const peer = new Peer({
      //We create a peer
      initiatior: false, //We are not the ones who are establishing the call
      trickle: false,
      stream: stream,
    });

    //We suscribe to the signal
    peer.on("signal", (data) => {
      //We emit "acceptCall" to the other user
      socket.current.emit("acceptCall", { signal: data, to: caller });
    });

    //We suscribe to the stream
    peer.on("stream", (stream) => {
      partnerVideo.current.srcObject = stream;
    });

    //We send a signal   (With the caller signal)
    peer.signal(callerSignal);
  }

  let UserVideo; //Variable that will store the video od the user
  if (stream) {
    //If we have stream...
    UserVideo = <Video playsInline muted ref={userVideo} autoPlay />;
  }

  let PartnerVideo; //Variable that will store the PartnerVideo
  if (callAccepted) {
    //If the call it's accepted
    PartnerVideo = <Video playsInline ref={partnerVideo} autoPlay />; //We render the partner video
  }

  let incomingCall; //Variable that will store the notification when an user send request for call
  if (receivingCall) {
    //if there is a recieving call
    incomingCall = ( //We render the notification
      <div>
        <h1>{caller} is calling you</h1>
        <button onClick={acceptCall}>Accept</button>
      </div>
    );
  }
  return (
    <Container>
      <Row>
        {UserVideo}
        {PartnerVideo}
      </Row>
      <Row>
        {Object.keys(users).map((key) => {
          if (key === yourID) {
            return null;
          }
          return <button onClick={() => callPeer(key)}>Call {key}</button>;
        })}
      </Row>
      <Row>{incomingCall}</Row>
    </Container>
  );
}

export default App;
