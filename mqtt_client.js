class Geo {
    constructor() {
        this.latitude = 0;
        this.longitude = 0;
        this.start = false;

        this.gps = null;
    }

    
    updateLocation() {
        if (!('geolocation' in navigator)) {
            console.log(`There is no "geolocation" on this navigator.`);
        } else {
            navigator.geolocation.getCurrentPosition((position) => {
                this.latitude = position.coords.latitude;
                this.longitude = position.coords.longitude;
            });
        }
    }
    
    getLocation() {
        if (navigator.geolocation) {
          this.gps = navigator.geolocation.watchPosition(sendLocation);
        } else {
          alert("Geolocation is not supported by this browser.");
        }
      }

    startGeolocation() {
        this.start = true;
        setInterval(() => {
            if(this.start){
                this.updateLocation();
                sendLocation();
            }
        }, 3000);
    }

    stopGeolocation(){
        this.start = false;
        navigator.geolocation.clearWatch(this.gps);
    }

    getCoordenadas() {
        return `${this.latitude},${this.longitude}`;
    }
}


var topico_listener = "listener";
var topico_cliente = "clientes";

var infos = {
    nome: null,
    id: null
}

geo = new Geo();
geo.updateLocation();

var client;

function conectarMQTT() {
    // Configurações do broker MQTT
    const broker = "wss://37ee3b382c624c81ba97e0c176dfefcf.s2.eu.hivemq.cloud:8884/mqtt"
    const options = {
        username: "Cliente",
        password: 'Ac57f8d56dfb28da7f7fc5dd99b64a7a223ae23ae3ef9f3a9ace3ccdeaad6aa22',
    };

    // Cria um novo cliente MQTT
    client = mqtt.connect(broker, options);

    client.on('connect', function () {
        console.log('Conectado ao broker MQTT');
        subscribe(topico_listener);
    });

    client.on('message', function (topic, message) {
        // Chama a função handleMessage com o tópico e a mensagem
        handleMessage(topic, message.toString());
    });

    client.on('error', (err) => {
        console.error('Erro ao conectar com o Broker MQTT:', err);
    });

    requestID();
}

function setInfo(nome, sala){
    infos.nome = nome;
    topico_cliente = sala + "-C";
    topico_listener = sala;
}


// Função para lidar com mensagens recebidas
var max_id = -1;
var lider = null;

var Timer;
function startTimer() {
    let timer = 100;
    Timer = setInterval(function() {
        if (timer > 0) timer--;
        else {
            if(max_id < infos.id) {
                sendClients(`!${infos.id}>VITORIA`);
                lider = infos.id;
            }
            clearInterval(Timer);
        }
        
    }, 10);
}

var Heartbeat;
function waitLider() {
    let timer = 500;
    console.log("HEARTBEAT")
    Heartbeat = setInterval(function() {
        if (timer > 0) timer--;
        else {
            console.log("LIDER MORREU");
            clearInterval(Heartbeat);
            eleicao();
        }
        
    }, 10);
}

/*
    ?nome                   => Pedir ID
    id>latitude,longitude   => Enviar localização
    ?nome:id                => Resposta do listener para o ID

    !id>eleicao             => o ID pede uma eleição
    !id>OK!                 => Respostas de que a eleição falhou
    !id>VITORIA             => ID venceu a eleição
*/

function handleMessage(topic, message) {
    console.log('Mensagem recebida no topico ' + topic + ': ' + message);

    if (topic === topico_listener) {
        let regex_id = /\?([a-z A-z 0-9]+):(\d+)/;
        let match = message.match(regex_id);    

        if (match && !infos.id) {
            let nome = match[1];
            if (nome === infos.nome){
                infos.id = Number(match[2]);
                console.log("Recebido ID:", infos.id);
                subscribe(topico_cliente);
                eleicao();
                //geo.startGeolocation()
                geo.getLocation();
            }
        }
    }

    if(topic === topico_cliente) {
        if(message[0] === "!"){
            msg_list = message.split(">");
            id = Number(msg_list[0].substring(1))
            
            if(id !== infos.id) {
                switch(msg_list[1]){
                    case "eleicao":
                        clearInterval(Heartbeat);
                        if(id < infos.id) {
                            sendClients(`!${infos.id}>OK!`);
                            clearInterval(Timer);
                            startTimer();
                        }
                        break;
                        
                    case "OK!":
                        if(max_id < id) {
                            max_id = id;
                        }

                        clearInterval(Timer);
                        startTimer();

                        break;

                    case "VITORIA":
                        clearInterval(Timer);
                        lider = id;
                        console.log("NOVO LIDER:", id);

                        clearInterval(Heartbeat);
                        waitLider();
                        break;
                }
            }
        }

        if(message.includes(">") && message.includes(",")){

            if(lider === infos.id) { // repasse das coordenadas para o listener
                sendListener(message);
                
            }
            else{
                msg_list = message.split(">");
                id = Number(msg_list[0])
                // Verifica se o lider está vivo
                if(lider === id) {
                    clearInterval(Heartbeat);
                    waitLider();
                }
            }
        }
        
    }
}

// Função para publicar uma mensagem
function publish(topic, message) {
    client.publish(topic, message, function (err) {
        if (err) {
            console.log('Erro ao publicar a mensagem: ' + err);
        }
    });
}

// Função para se inscrever em um tópico
function subscribe(topic) {
   client.subscribe(topic, function (err) {
       if (err) {
           console.log('Erro ao se inscrever no tópico: ' + err);
       }
   });

   console.log("Inscrito em " + topic);
}

function sendListener(message) {
    publish(topico_listener, message);
}

function sendClients(message) {
    publish(topico_cliente, message);
}

function requestID() {
    sendListener(`?${infos.nome}`);
}

function eleicao(){
    clearInterval(Timer);
    startTimer();
    sendClients(`!${infos.id}>eleicao`);
}

/*
function sendLocation() {
    if (infos.id !== null){
        geo.updateLocation();
        coordenadas = geo.getCoordenadas();
        if(lider == infos.id)
            sendListener(`${infos.id}>${coordenadas}`);
        else
            sendClients(`${infos.id}>${coordenadas}`);
    }
}*/

function sendLocation(position) {
    if (infos.id !== null){
        coordenadas = `${position.coords.latitude},${position.coords.longitude}`
        if(lider == infos.id)
            sendListener(`${infos.id}>${coordenadas}`);
        else
            sendClients(`${infos.id}>${coordenadas}`);
    }
}
