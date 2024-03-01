
import Head from 'next/head' 
import Lottie from "lottie-react";
import imageData from "../public/assets/lottiefilles/working-serve.json";  

export default function Home() { 
    const style = {
        height: 300, 
    };
      
   


    return (
        <>
            <Head>
                <title>Under Maintenance | Apsis Solutions Limited </title>
                <meta name="description" content="Apsis Solutions Limited" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="shortcut icon" type="image/png" href='/assets/apsis_logo.png' />
            </Head>

            <main> 

                <div className="container">
                    <div className="row d-flex justify-content-center align-items-center text-center vh-100">
                        <div className="col-lg-6 mx-auto">
                            <figure className="m-0">
                                <Lottie
                                    animationData={imageData}
                                    style={style} 
                                />
                            
                            </figure>
                            <h1 className="mb-2 display-5 title">Your Application is <span style={{ color: 'red' }}>DOWN</span></h1>
                            <p className="col-sm-8 mx-auto"><strong>Important:</strong> You are here because the associated port of the URL appears to be down. Please bring it <span style={{ color: 'green' }}>up</span> or get in touch with the infra team.</p>
                        </div>
                    </div>
                </div>

            </main>

        </>
    )
}
